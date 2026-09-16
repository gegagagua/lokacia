# Operations — lokacia.ge

Runbook for production and staging: topology, deploys, security, observability, backups and restores, performance, and demo/seed tooling.
Launch gating lives in [`LAUNCH.md`](./LAUNCH.md).

## 1. Topology

```
Cloudflare (DNS, WAF, TLS, Turnstile)
  └─ Caddy (infra/caddy/Caddyfile) — lokacia.ge · crm. · admin. · api.
       ├─ web   ×2  (Next.js, :3100)   ┐
       ├─ crm   ×1  (Next.js, :3101)   ├─ same-origin /api/v1/* rewrite → api:4000
       ├─ admin ×1  (Next.js, :3102)   ┘
       └─ api   ×2  (NestJS HTTP, JOBS_ENABLED=false) ──┐
worker ×1..n (NestJS app context, BullMQ, JOBS_ENABLED=true) ─┤
                                                         ├─ PgBouncer → PostgreSQL 16 + PostGIS (pgBackRest → R2)
                                                         ├─ Redis 7 (AOF, noeviction) — BullMQ + rate limits
                                                         ├─ Meilisearch (optional, SEARCH_ENGINE=meilisearch)
                                                         └─ R2 (media) + imgproxy
```

| file | purpose |
|---|---|
| `infra/docker/api.Dockerfile` | API image (`runtime` target) and migrations image (`migrate` target). The worker uses the API image with `command: node apps/api/dist/src/worker.js` |
| `infra/docker/{web,crm,admin}.Dockerfile` | Next.js images. `NEXT_PUBLIC_*` and `API_URL` (used by rewrites) are set at build time, so each environment gets its own image |
| `infra/docker-compose.prod.yml` | production/staging stack: api, worker, web, crm, admin, caddy, postgres, pgbouncer, redis, meilisearch (profile), imgproxy, migrate (profile) |
| `infra/caddy/Caddyfile` | TLS, host routing, Cloudflare real-IP handling, admin IP allow-list |
| `.github/workflows/deploy.yml` | build → push to GHCR → migrate → rolling update → smoke check → e2e (staging) |
| `.github/workflows/quality.yml` | Lighthouse CI budgets and k6 smoke on a production build |

Every image is multi-stage: `turbo prune --docker`, then `pnpm install --frozen-lockfile` (cached on the lockfile), then `turbo build`, then a runtime stage on `node:24-alpine` that runs as non-root user `lokacia` (uid 1001) under `tini`, with a `HEALTHCHECK`.
Docker was not available on the dev machine, so the images are validated in CI (the `deploy.yml` build job).
**Follow-up:** set `output: 'standalone'` in each Next app's `next.config.ts`, then copy `.next/standalone`, `.next/static` and `public` into the runtime stage instead of the whole workspace. This cuts the image from about 1 GB to about 150 MB.

### Worker (`apps/api/src/worker.ts`)
- Boots `NestFactory.createApplicationContext(AppModule)` with no HTTP listener. Every module registers its queue handlers and schedules in `onModuleInit`. `QueueService` then starts the BullMQ `Worker` and upserts the job schedulers.
- Forces `JOBS_ENABLED=true`. API pods run with `JOBS_ENABLED=false`, so they only enqueue work.
- On SIGTERM/SIGINT it calls `app.close()`, which closes the BullMQ worker and waits for jobs in flight. It then flushes Sentry and OTel. It hard-exits after `WORKER_SHUTDOWN_TIMEOUT_MS` (default 30 s); compose uses `stop_grace_period: 45s`.
- Verified locally: it boots against the dev Redis and logs "BullMQ ready (9 handlers, 5 schedules)", and a SIGTERM drains it and exits 0.
- Run it locally: `pnpm --filter @lokacia/api build && pnpm --filter @lokacia/api worker`. Scale it horizontally; BullMQ job schedulers are deduplicated.

## 2. Deploy

- **Staging:** every green `CI` run on `main` triggers `deploy.yml` through `workflow_run`. Images are tagged `sha-<12>` and `staging`.
- **Production:** push a tag `v*`. The GitHub environment `production` must have **required reviewers**. Images are tagged `vX.Y.Z` and `production`.
- **Manual:** `workflow_dispatch` with an environment and a ref.

Pipeline per environment:
1. Build and push `lokacia-{api,migrate,web,crm,admin}` to GHCR. Buildx uses the GHA cache and produces provenance and an SBOM.
2. `rsync` the compose, Caddy, backup and postgres configs to `/srv/lokacia/infra` on the host.
3. `docker compose pull`.
4. **Migrations:** `docker compose --profile migrate run --rm migrate`, which runs as the schema-owner role, directly against Postgres and not through PgBouncer. The deploy aborts if it fails.
5. **Rolling update:** `docker rollout` ([wowu/docker-rollout](https://github.com/wowu/docker-rollout)) runs for api, web, crm and admin. It starts the new containers beside the old ones, waits for the `HEALTHCHECK` to pass, then drains and removes the old ones. Caddy health-checks its upstreams (`/v1/health`, `/`), so no request hits a container that is starting or stopping. The worker is then restarted with `up -d`, and BullMQ re-queues any stalled jobs.
6. **Smoke check:** `GET /v1/health` must return `"status":"ok"` and `GET /` must return 200. On staging, the Playwright suite (`pnpm test:e2e`) then runs against the staging URLs.

**Zero-downtime rules (expand/contract):** a migration must be compatible with **both** the running and the new release. Add nullable columns and new tables in release N. Backfill in a job. Only drop or rename in release N+1. Never put `ALTER TABLE … SET NOT NULL` on a large table without a `NOT VALID` constraint followed by `VALIDATE`.

**Rollback:** `IMAGE_TAG=<previous tag> docker rollout -f infra/docker-compose.prod.yml api` (repeat for web, crm and admin). Expand-only migrations do not need a rollback. If a destructive migration shipped by mistake, use PITR (section 5).

**Host prerequisites:**
- Docker 27+ with compose v2 and the `docker-rollout` plugin
- `/srv/lokacia/.env` holding production secrets (see `.env.example`)
- An origin firewall that allows 80/443 only from [Cloudflare IP ranges](https://www.cloudflare.com/ips/)
- A `deploy` user whose SSH key is stored in `DEPLOY_SSH_KEY`

GitHub configuration per environment:
- **vars:** `APP_URL`, `CRM_URL`, `ADMIN_URL`, `API_PUBLIC_URL`, `MAPTILER_KEY`, `TURNSTILE_SITE_KEY`, `DEPLOY_HOST`
- **secrets:** `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`

## 3. Security review (Phase 14) — 2026-09-16

| # | area | finding | status |
|---|---|---|---|
| S1 | Web CSP (`apps/web/next.config.ts`) | CSP present: `default-src 'self'`, `frame-ancestors 'self'`, `base-uri`, `form-action`, allow-listed map, Turnstile and Jitsi hosts. `ws://localhost:4000` was sent to **production** in `connect-src` | **Fixed:** that source is now added only when `NODE_ENV=development` |
| S2 | Web CSP | `script-src 'unsafe-inline'` is needed by Next.js without nonces | Open (medium): move to a nonce-based CSP generated in `src/proxy.ts` (`'nonce-…' 'strict-dynamic'`) |
| S3 | Web headers | HSTS `max-age=63072000; includeSubDomains; preload`, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `poweredByHeader: false` | OK. Submit the domain to hstspreload.org after launch (HUMAN) |
| S4 | CRM/admin apps | Apps are still being built; they must copy the web security headers. Admin should use `frame-ancestors 'none'`, `X-Robots-Tag: noindex` and the IP allow-list (Caddy `ADMIN_ALLOW_CIDR`) | Open (owners: CRM/admin streams) |
| S5 | API helmet (`apps/api/src/main.ts`) | helmet 8 defaults: HSTS 365 d with includeSubDomains, `nosniff`, frameguard, `hidePoweredBy`. CSP disabled (JSON API plus Swagger UI). `crossOriginResourcePolicy: cross-origin` is needed for media | OK. Recommend gating `/v1/docs` behind an admin role or disabling it in production |
| S6 | CORS (`bootstrap.ts`) | Origins limited to `APP_URL`, `CRM_URL` and `ADMIN_URL`, with `credentials: true` | OK |
| S7 | Auth cookies (`tokens.service.ts`) | `lk_at` (15 min) and `lk_rt` (30 d, rotating): `httpOnly`, `SameSite=Lax`, `Secure` in production, optional `COOKIE_DOMAIN` | OK |
| S8 | OAuth state cookie (`auth.controller.ts`) | `lk_oauth_state` had no `Secure` flag | **Fixed:** `secure` in production |
| S9 | OTP rate limits (`auth.service.ts`) | Request limits: 5 per phone per hour and 20 per IP per hour. Verify limits: 10 per phone per 15 min, plus 5 attempts per code. Turnstile is verified **only when `TURNSTILE_SECRET` is set**. The dev code `123456` is rejected when `NODE_ENV=production` | OK. `TURNSTILE_SECRET` is mandatory in production (LAUNCH.md) |
| S10 | Phone reveal (`listings.service.ts`) | Limited per IP hash (setting `reveal_rate_limit_per_hour`, default 20) and per user (2× that). Every reveal is logged as a `listing_events` `reveal` row with the IP hash | OK |
| S11 | Contact endpoints | `POST /v1/conversations`, `/with-user` and `/:id/messages` require auth but have **no rate limit**. The demand, viewings, services and projects lead endpoints are still being built | Open (high before launch): add `rate.hit('contact:user:<id>', 30, 3600)` and Turnstile for anonymous leads |
| S12 | Client IP (`decorators/index.ts` `ClientIp`) | Trusts `CF-Connecting-IP` unconditionally. If a client can reach the origin directly, it can spoof the header and dodge the IP rate limits | **Fixed at the edge:** Caddy trusts only Cloudflare ranges and overwrites `CF-Connecting-IP` with the verified client IP (`header_up`). The origin firewall must allow only Cloudflare |
| S13 | Rate-limit store | `RedisService.incr` silently falls back to in-memory storage when Redis is down, which gives per-pod limits | Alert when `/v1/health` reports `redis: "fallback"` (Grafana and uptime) |
| S14 | Production secrets (`config/env.ts`) | JWT secrets were enforced in production; the `IP_HASH_SALT` and `PAYMENTS_WEBHOOK_SECRET` dev defaults were not | **Fixed:** the API refuses to boot in production with `dev_*` values |
| S15 | Logs and PII | pino redacts `cookie`, `authorization` and `set-cookie`. Sentry is initialised with `sendDefaultPii: false`. OTel pg instrumentation does not record SQL parameters | OK. Also redact `req.headers["x-api-key"]` (app.module, owner: API stream) |
| S16 | Personal-data endpoints | Data export/delete endpoints and the consent log (Phase 14 roadmap item) are not reviewed here | Open, tracked in ROADMAP Phase 14 |

Files changed by this review:
- `apps/web/next.config.ts` (S1)
- `apps/api/src/modules/auth/auth.controller.ts` (S8)
- `apps/api/src/config/env.ts` (S14)
- `infra/caddy/Caddyfile` (S12)

## 4. Observability

### Sentry and OpenTelemetry (`apps/api/src/common/observability/`)
- `register-api.ts` is the first import in `main.ts`; `register-worker.ts` is the first import in `worker.ts`. Both are **no-ops when `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` are empty**, and then load nothing.
- The SDKs are **optional runtime packages**, not repo dependencies, which keeps the monorepo light. If an env var is set but its package is missing, a warning is logged and the service continues. To enable them in an image, add this to the api Dockerfile runtime stage:
  ```dockerfile
  RUN cd apps/api && npm i --no-save @sentry/node @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
      @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/sdk-metrics
  ```
- Env settings:
  - `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` (default 0), `GIT_SHA` (used as the release)
  - `OTEL_EXPORTER_OTLP_ENDPOINT` (for example `http://otel-collector:4318`), `OTEL_SERVICE_NAME` (default `lokacia-api` or `lokacia-worker`)
  - `OTEL_SEMCONV_STABILITY_OPT_IN=http`, set automatically so the metric is `http.server.request.duration`
- `captureException(err, extra)` is exported for explicit reporting, for example from the problem+json filter on 5xx.

### Grafana (`infra/grafana/lokacia-api.json`)
Import it through Dashboards → Import and choose a Prometheus datasource. It expects these sources:
- **OTel metrics → Prometheus** (through the collector's `prometheus` or `prometheusremotewrite` exporter): `http_server_request_duration_seconds_*` labelled `service_name`, `http_route`, `http_response_status_code`
- **blackbox_exporter** probing `https://api.lokacia.ge/v1/health` (`probe_success`), which gives the uptime SLO
- **redis_exporter** with `REDIS_EXPORTER_CHECK_KEYS=bull:lokacia:wait,bull:lokacia:active,bull:lokacia:delayed,bull:lokacia:failed` (BullMQ queue depth)
- **postgres_exporter** (`pg_stat_activity_count`, `pg_settings_max_connections`, `pg_stat_archiver_*` for WAL archiving and PITR health)

Panels:
- uptime (24 h)
- request rate
- p95 latency
- 5xx ratio
- per-route rate
- p50/p95/p99 latency
- search API p95 against the 300 ms line
- 5xx, 4xx and 429 rates
- BullMQ depth
- Postgres connections
- WAL archive failures
- process memory and event loop

Alerts to create:

| alert | condition |
|---|---|
| Uptime | < 99.9 % over 1 h |
| 5xx ratio | > 1 % for 5 min |
| Search p95 | > 300 ms for 10 min |
| BullMQ wait | > 500 for 10 min |
| Failed jobs | increase > 50 per hour |
| WAL archiving | `pg_stat_archiver_failed_count` increases |
| Last backup | older than 26 h |
| Redis fallback | health reports `redis: "fallback"` |

### Uptime checks
External monitor (Better Stack, UptimeRobot or blackbox) every 60 s:
- `https://api.lokacia.ge/v1/health`: expect 200 and `"status":"ok"`
- `https://lokacia.ge/`: 200
- `https://crm.lokacia.ge/login`: 200

## 5. Backups and PITR (`infra/backup/`)

- **Tool:** pgBackRest ([`pgbackrest.conf`](../infra/backup/pgbackrest.conf)), with its repository in a Cloudflare R2 bucket `lokacia-pg-backups`. Backups are encrypted client-side (AES-256), compressed with zstd, and bundled with block-incremental backup.
- **Schedule** ([`crontab`](../infra/backup/crontab)): a full backup on Sunday at 02:00, a differential backup at 02:00 on the other days, and `pgbackrest check` every day.
- **WAL:** [`postgresql.conf`](../infra/backup/postgresql.conf) sets `archive_mode=on`, `archive_command=pgbackrest archive-push`, `archive_timeout=60`, and pushes asynchronously. **RPO ≤ 1 min.**
- **Retention:** full backups are kept 21 days (time based) and differentials 14. WAL is kept for every retained full backup, so **point-in-time recovery reaches back at least 14 days** (ARCHITECTURE.md).
- **One-time setup:**
  1. `pgbackrest --stanza=lokacia stanza-create`
  2. `pgbackrest --stanza=lokacia check`
  3. Take the first full backup.
- **Media:** R2 bucket `lokacia-media` with object versioning on and a lifecycle rule that keeps noncurrent versions for 30 days.
- **Redis:** AOF is on. The queue state can be rebuilt, so Redis is not backed up.
- **Meilisearch:** rebuildable from Postgres by reindexing, so it is not backed up.

### Restore drill (monthly, and before launch)
Run [`infra/backup/restore-drill.sh`](../infra/backup/restore-drill.sh) on the **staging** host. It never touches the production data directory.

1. `./restore-drill.sh` restores the latest backup. For a PITR test use `TARGET_TIME="2026-09-16 14:30:00+04" ./restore-drill.sh`.
2. The script restores into `/srv/restore-drill/pgdata` and starts a throwaway `postgis/postgis:16-3.5` container on 127.0.0.1:55432 with archiving disabled.
3. It checks the following, then prints the **RTO** in seconds and removes the container:
   - recovery has finished (`not pg_is_in_recovery()`)
   - drizzle migrations count
   - listing and user counts
   - latest `updated_at`
   - PostGIS version
   - generated geography columns are filled
4. Compare the counts with production (`select count(*) from listings`) and confirm the latest `updated_at` is within the RPO of the target time.
5. Record the result in the log below. **Target:** RTO < 60 min for the full database, RPO ≤ 1 min.

**Real incident (production restore):**
1. Put the web app into maintenance mode: scale api to 0 and have Caddy serve a static maintenance page.
2. `pgbackrest --stanza=lokacia --delta --type=time --target="<before incident>" --target-action=promote restore`
3. Start Postgres and check the counts.
4. `pgbackrest stanza-upgrade` if needed, then start a **new full backup** right away.
5. Scale api, worker and web back up.
6. Reindex search.
7. Write a post-mortem.

| date | type | target | RTO | result | by |
|---|---|---|---|---|---|
| — | first drill due before beta | latest | — | — | — |

## 6. Performance: Lighthouse CI and k6

### Lighthouse CI (`infra/lighthouse/`)
- `lighthouserc.json` uses mobile emulation with simulated throttling and 3 runs (median) on `/`, `/search` and a listing page.
- **Errors fail the run when:** performance < 0.9, accessibility < 0.9, SEO < 0.9, LCP > 2500 ms, or CLS > 0.1. Best-practices and TBT only warn.
- `budgets.json` sets timings (LCP 2.5 s, FCP 1.8 s, TTI 3.8 s) and resource sizes (JS 350 KB, CSS 60 KB, fonts 150 KB, total 1 MB; `/map` gets JS 700 KB).
- The `quality.yml` job builds api and web in production mode, seeds the database, picks a real listing slug and runs `lhci autorun`.
- Run locally against a **production build** (`pnpm --filter @lokacia/web build && pnpm --filter @lokacia/web start`). Dev mode scores are meaningless.
  ```bash
  npx @lhci/cli@0.15.x autorun --config=infra/lighthouse/lighthouserc.json
  ```

### k6 (`infra/k6/`)
- `search.js` hits `GET /v1/listings` with random business-type, deal, district, area, price, sort and q filters, paginates a second page for 30 % of iterations, and requests `/v1/listings/map` for 20 %.
  Thresholds: **search p95 < 300 ms**, p99 < 800 ms, map p95 < 500 ms, errors < 1 %, checks > 99 %.
- `listing.js` hits `GET /v1/listings/:slug`, `/similar` and the SSR page `/listings/:slug` (the page has to contain JSON-LD).
  Thresholds: API p95 < 300 ms, similar p95 < 400 ms, page p95 < 800 ms. Set `PAGES=0` for an API-only run.
- **Env:**

  | variable | default |
  |---|---|
  | `BASE_URL` | `http://localhost:4000` |
  | `WEB_URL` | `http://localhost:3100` |
  | `TARGET_VUS` | 50 |
  | `SMOKE=1` | 2 VUs for 10 s |

  Default stages: ramp over 30 s, then 1 m, hold 3 m, ramp down 30 s.

Seed a **dedicated** load-test database. Never use the shared `lokacia` DB: the seed truncates every table.
```bash
createdb -O lokacia lokacia_load
psql -d lokacia_load -c "CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION lokacia; CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions; ALTER DATABASE lokacia_load SET search_path = public, extensions; ALTER SCHEMA public OWNER TO lokacia;"
SEED_DATABASE_URL=postgres://lokacia:lokacia@localhost:5432/lokacia_load pnpm load:seed   # migrate + SEED_LISTINGS=50000 (≈ 85 s)
# run an API against it (production build, no jobs)
PORT=4010 DATABASE_URL=postgres://lokacia:lokacia@localhost:5432/lokacia_load JOBS_ENABLED=false node apps/api/dist/src/main.js
brew install k6   # not installed on the dev machine
k6 run -e BASE_URL=http://localhost:4010 -e PAGES=0 infra/k6/search.js     # or: pnpm load:search
k6 run -e BASE_URL=http://localhost:4010 -e PAGES=0 infra/k6/listing.js
```
`pnpm load:seed` refuses to run without `SEED_DATABASE_URL`.

**Baseline (2026-09-16, MacBook dev machine, Homebrew PG 17):** 50 000 listings and 333 761 media rows, postgres search engine, 20 concurrent clients with no think time (about 225 req/s), 30 s. k6 was not installed, so an equivalent Node script ran the same query mix.

| endpoint | p50 | p95 | p99 | errors |
|---|---|---|---|---|
| `GET /v1/listings` (search) | 24 ms | **134 ms** | 257 ms | 0 |
| `GET /v1/listings/:slug` | 21 ms | 63 ms | 100 ms | 0 |
| `GET /v1/listings/map` | 96 ms | 228 ms | 350 ms | 0 |

The search p95 < 300 ms threshold passes with headroom. Re-run with k6 on staging hardware before launch.

## 7. Seed, demo and beta data

| command | what it does |
|---|---|
| `pnpm db:migrate && pnpm db:seed` | Demo dataset (`packages/db/src/seed`). **Truncates all public tables.** Creates 10 demo accounts (phones `+995500000001…10`, OTP `123456` outside production), 5 organizations (agencies and a developer), about 12 brokers, `SEED_LISTINGS` listings (default 700) with generated SVG "drawing" photos, POIs, CRM data and billing demo |
| `SEED_LISTINGS=50000 SEED_DATABASE_URL=… pnpm load:seed` | Load-test dataset in a separate DB (above) |
| `pnpm --filter @lokacia/api import:osm` | Real OSM POI import (needs network) |
| `pnpm db:reset` | Drops, migrates and seeds. **Local only.** Never run it on the shared dev DB or on staging/prod |

### Beta mode (50 brokers, 300+ real spaces)
The beta runs on **staging-like production** (`NODE_ENV=production`, real SMS, no dev OTP) with an empty database, **not** the demo seed:
1. `pnpm db:migrate` only; production never runs `db:seed`. Load the taxonomy and districts reference data with the taxonomy/district part of the seed, or through the admin taxonomy editor.
2. Create the agencies (admin → organizations). Each manager invites their brokers by phone (CRM → team). Invitations are accepted on the first OTP login.
3. **Spaces import:** partners deliver a CSV in the format of [`infra/seed/spaces-import.example.csv`](../infra/seed/spaces-import.example.csv), one row per space. Columns:
   - `external_id` (idempotency key)
   - `agency_slug`, `broker_phone` or `owner_phone`
   - `deal_type` (rent/sale/transfer/short_term)
   - `business_types` (pipe-separated taxonomy slugs)
   - `title_ka`, `description_ka`
   - `city`, `district_slug`, `address_ka`, `lat`, `lng`
   - `area_m2`, `floor`
   - `price_gel` (whole GEL; stored as tetri × 100), `price_period` (month/total/day/hour), `commission_pct`, `is_owner`
   - passport fields (camelCase keys in `PASSPORT_KEYS`, snake_case in the CSV)
   - `photo_urls` (pipe-separated), `floor_plan_url`, `last_confirmed_at`
4. Import rules:
   - Rows are validated with the `@lokacia/contracts` listing schema and Georgian script checks.
   - Photos go through the normal media pipeline (download, EXIF strip, imgproxy variants).
   - Listings are created as `pending_moderation`, so the moderation queue reviews them.
   - Re-running with the same `external_id` updates the listing instead of duplicating it.
   - **Status:** the importer endpoint/CLI is not built yet (owner: API/CRM stream; the CRM "import" feature should reuse this format).
5. Demo mode for sales presentations: a separate `demo.lokacia.ge` environment running the full demo seed with `NODE_ENV=production` plus a whitelisted `OTP_DEV_CODE`. **Not implemented:** the dev code is intentionally disabled in production. Use staging for demos.

## 8. Design system QA (Storybook, a11y, unit tests)
- `pnpm storybook` (dev, :6006) · `pnpm build-storybook` → `packages/ui/storybook-static`.
- Theme toolbar (Light/Dark) sets `data-theme` on `<html>` exactly like the Next apps; `@storybook/addon-a11y` runs axe in the panel (`parameters.a11y.test = 'error'`).
- `pnpm test:a11y` builds Storybook and audits **every story in light and dark** with axe-core in headless Chromium (`packages/ui/scripts/storybook-a11y.mjs`, WCAG 2.0/2.1/2.2 A+AA tags; map tile attribution excluded). CI: `storybook` job in `.github/workflows/quality.yml`.
- Unit tests: `pnpm --filter @lokacia/ui test` (vitest; component tests use a `// @vitest-environment jsdom` docblock): tokens contrast, SpacePlan dimension labels, ListingCard badges/confirmed label/favorite, PriceTag formatting, Kanban keyboard move.
- Sample data for stories lives in `packages/ui/src/stories/fixtures.ts` (Georgian copy, drawing placeholders — no stock photos).

## 9. Brand assets & favicons
- Source of truth: `packages/ui/src/brand/svg.ts` (`markSvg()`, `MARK_SVG_LIGHT/DARK/MASKABLE/APPLE`, `lockupSvg()`), exported from `@lokacia/ui`. React components stay in `brand/logo.tsx`.
- Generate per app: `pnpm --filter @lokacia/ui brand:assets -- ../../apps/<web|crm|admin>` (renders PNGs with headless Chromium; needs `npx playwright install chromium`). It writes Next metadata files `src/app/icon.svg` + `src/app/apple-icon.png` (Next injects `<link rel="icon">` / `apple-touch-icon` automatically) and `public/{favicon-32,icon-192,icon-512,icon-maskable-512}.png`, `public/logo.svg`, `public/logo-dark.svg`.
- Reference the PNGs from each app's `public/manifest.webmanifest` (`purpose: "any"` for 192/512, `"maskable"` for the maskable one) — done for apps/web. CRM/admin: run the same command when their app dirs are stable; optionally tint admin (`markSvg({ background: '#17201D', stroke: '#6FB3A2' })`) so staff can tell tabs apart.
