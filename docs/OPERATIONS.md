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
| S11 | Contact endpoints | `POST /v1/conversations`, `/with-user` and `/:id/messages` require auth but have **no rate limit**. The demand, viewings, services and projects lead endpoints are still being built | **Fixed 2026-09-17** (§10 SR-20/SR-21): messaging, offers and viewings are rate-limited |
| S12 | Client IP (`decorators/index.ts` `ClientIp`) | Trusts `CF-Connecting-IP` unconditionally. If a client can reach the origin directly, it can spoof the header and dodge the IP rate limits | **Fixed at the edge:** Caddy trusts only Cloudflare ranges and overwrites `CF-Connecting-IP` with the verified client IP (`header_up`). The origin firewall must allow only Cloudflare |
| S13 | Rate-limit store | `RedisService.incr` silently falls back to in-memory storage when Redis is down, which gives per-pod limits | Alert when `/v1/health` reports `redis: "fallback"` (Grafana and uptime) |
| S14 | Production secrets (`config/env.ts`) | JWT secrets were enforced in production; the `IP_HASH_SALT` and `PAYMENTS_WEBHOOK_SECRET` dev defaults were not | **Fixed:** the API refuses to boot in production with `dev_*` values |
| S15 | Logs and PII | pino redacts `cookie`, `authorization` and `set-cookie`. Sentry is initialised with `sendDefaultPii: false`. OTel pg instrumentation does not record SQL parameters | OK. Also redact `req.headers["x-api-key"]` (app.module, owner: API stream) |
| S16 | Personal-data endpoints | Data export/delete endpoints and the consent log (Phase 14 roadmap item) are not reviewed here | Reviewed 2026-09-17 (§10 SR-37/SR-38) |

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

### New-module load smoke (`infra/load/new-modules.mjs`, Phase 25)
`pnpm load:modules` (Node, no k6): weighted mix of `GET /v1/billing/plans`, `GET /v1/crm/deals` (manager session + RLS transaction), `GET /v1/v2/listings/:id/score` (already-computed scores only, no AI calls) and `GET /v1/public/districts` (API key, metered). Env: `BASE_URL`, `CONCURRENCY` (20), `DURATION_S` (30), `CRM_PHONE`, `API_KEY`, `P95_MS` (300). Fails when a scenario's p95 ≥ `P95_MS` or non-429 errors ≥ 1 %; 429s are reported separately.

**Baseline (2026-09-17, dev machine, `:4000` watch-mode API on the shared demo DB, 20 clients, 20 s, warm caches):**

| endpoint | req/s | p50 | p95 | p99 | errors | note |
|---|---|---|---|---|---|---|
| `GET /v1/billing/plans` | 421 | 4 ms | **6 ms** | 7 ms | 0 | |
| `GET /v1/crm/deals` | 843 | 15 ms | **19 ms** | 24 ms | 0 | 60 clients: p95 47 ms, 0 errors |
| `GET /v1/v2/listings/:id/score` | 421 | 6 ms | **8 ms** | 11 ms | 0 | |
| `GET /v1/public/districts` | 421 | 38 ms | **68 ms** | 76 ms | 0 | 96 % answered 429 by the per-key limit (300/min) as designed; p95 is over the 300 accepted calls |

Findings from the first run (fixed): 20 concurrent `GET /v1/crm/deals` **deadlocked the whole API** (pool starvation, SR-40 below), and API-key metering updated `api_keys.last_used_at` on every call (hot-row lock; public API p95 1.2 s → 68 ms after limiting it to once a minute).

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

## 10. Security review 2026-09 (Phase 25: payments, escrow, API sweep) — 2026-09-17

Scope: payments/billing and PSP webhooks, escrow + ledger, rent/autopay, an authorization/IDOR sweep of every API module (portal, CRM, admin, v2), input/abuse limits, sessions/CSRF, personal data (Georgian PDP law), dependencies, and a load smoke of the new modules. Regression tests: `apps/api/test/security-payments.test.ts`, `security-api.test.ts`, `crm-security.test.ts` (+ updated `transactions`, `crm-deals`, `crm-calendar`, `crm-shared`). Full API suite: 34 files / 163 tests green.

Severity: C critical · H high · M medium · L low. Paths are under `apps/api/src` unless noted.

### Payments and billing
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-01 | H | `markPaid` accepted any non-`succeeded` payment, so a `refunded` payment could settle again, and effects ran per *payment* not per *invoice*: a retry link + late webhook for the old attempt (or two attempts) re-applied VIP / subscription / rent / escrow effects | **Fixed** `modules/billing/billing.service.ts`: forward-only `created/pending/failed → succeeded`, invoice settles once (`status <> paid/void`); extra settlement is flagged `raw.needsRefund` and logged |
| SR-02 | M | Bank adapters compared the HMAC with `!==` (timing leak) and trusted payload shape; the webhook controller fell back to `JSON.stringify(req.body)` when the raw body was missing | **Fixed** `integrations/payments/payments.ts` `verifyHmacSignature` (hex, length, `timingSafeEqual`), strict payload parsing in mock + bank adapters, `billing.controller.ts` returns 400 without the raw body |
| SR-03 | M | A success webhook without `amount` settled the payment; currency was never compared | **Fixed**: success needs exact amount and matching currency, otherwise `failed` + `mismatch` |
| SR-04 | M | Event row was inserted before processing; a crash in between made every PSP retry a "duplicate" → paid but never settled | **Fixed**: an event without `processed_at` is processed again (all transitions are conditional updates) |
| SR-05 | L | `refunded` event moved a never-settled payment to `refunded` | **Fixed**: only `succeeded → refunded` |
| SR-06 | L | Report checkout accepted any `orgId` (invoice visible to that org's managers) | **Fixed**: membership required |
| SR-07 | L | No checkout rate limit (invoice spam, unlimited instant promo checkouts); negative/int4-overflow amounts and concurrent identical idempotency keys produced 500s | **Fixed**: 30 checkouts/h per user, amount validation + `MAX_INVOICE_MINOR`, unique-violation → existing payment |
| SR-08 | — | IDOR on invoices / receipt PDF / payment summary / mock-complete; mock-complete in production | **OK** (verified + tests) |

### Escrow, ledger, rent
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-09 | H | Every `POST /escrow/:id/fund` click issued a new deposit invoice → tenant could pay twice; the second deposit was silently absorbed (no ledger, no refund) | **Fixed** `modules/v2/escrow/escrow.service.ts`: open checkout reused (`BillingService.openCheckout`), deposits for a non-pending escrow are flagged for refund |
| SR-10 | M | Concurrent `POST /escrow` created several escrows for one offer | **Fixed**: transaction-scoped advisory lock per offer (no migration) |
| SR-11 | — | Skipped/duplicated transitions (release before funding, double release, refund after release), non-party access, ledger balance | **OK**: `SELECT … FOR UPDATE` + transition table; tests prove one ledger tx per transition |
| SR-12 | M | Rent penalty `rent × pct/day × days` uncapped → int4 overflow after ~430 days crashed the nightly job for all leases; autopay charged ended/deleted leases and one failure aborted the batch | **Fixed** `modules/v2/property/property.service.ts`: penalty capped at 100 % of rent (`latePenaltyMinor`), autopay filters active/non-deleted, per-row isolation, never two off-session charges per rent invoice |

### Authorization, sessions, CSRF
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-13 | H | Google login linked an existing account by (unverified) profile e-mail → account pre-hijacking; banned/deleted users could log in with Google | **Fixed** `modules/auth/auth.service.ts` `resolveGoogleUser`: match by Google `sub` only, e-mail stored only if `email_verified`, existing e-mail → 409, ban check, `iss`/`exp` checked |
| SR-14 | M | Impersonation refresh lived 30 days (sliding) and `impersonation/stop` re-issued an admin session to whoever held the cookie; moderators could be impersonated; money/API-key/account actions allowed while impersonating | **Fixed**: impersonation sessions 1 h non-sliding (`IMPERSONATION_TTL_S`), staff targets refused, `@NoImpersonation()` on checkout, mock-complete, escrow sign/fund/release/refund, rent pay, API keys, data export, account delete |
| SR-15 | L | Concurrent refreshes with one token bypassed reuse detection; JWT verify didn't pin `HS256`; moderators could unban admins/moderators; OTP verify limited per phone only | **Fixed**: atomic session claim, `algorithms: ['HS256']`, unban role check, + 30 verifies/15 min per IP |
| SR-16 | M | CSRF relied on `SameSite=Lax` only; mutations accepted `x-www-form-urlencoded`, `text/plain`, `multipart` bodies (form-postable from a sibling subdomain) | **Fixed** `bootstrap.ts` `jsonOnlyMutations`: bodies must be JSON (415 otherwise); exceptions: signed local media PUT, CRM imports |
| SR-17 | C | `GET /v1/media/files/*` (public) served **any** storage key: `contracts/<offerId>.pdf` (names, phones), `reports/<id>.pdf` (paid product), CRM import files | **Fixed** `modules/media/media.controller.ts`: only `uploads/<yyyy-mm>/<uuid>/<file>` keys |
| SR-18 | H | Stored XSS: MIME and extension came from the client, bytes were never checked, `.svg` was served inline as `image/svg+xml` on the app origin | **Fixed** `media.service.ts`: extension allow-list, magic-byte sniffing (`sniffUpload`), sharp format allow-list, markup refused, upload URL single-use; files served with `nosniff`, `CSP: default-src 'none'; sandbox`, `attachment` for non-media types, no SVG type |
| SR-19 | M | S3 presigned PUT signs only `host`: direct-to-bucket uploads have no size/type limit | **Partial**: `process()` deletes > 25 MB / markup uploads and marks them failed. Remaining: presigned POST with `content-length-range` |
| SR-20 | H | Messaging had no rate limit; `/conversations/with-user` messaged any user id; attachments accepted any URL (phishing "PDF" links) | **Fixed** `modules/messaging/messaging.service.ts`: counterparts only (offer/viewing/lease/escrow/service order/existing thread), 20 new threads/h, 30 msgs/min + 300/h, attachments must be our uploads |
| SR-21 | M | Offers (create/counter), viewing requests (each sends SMS) and AI stats explanations had no rate limits | **Fixed**: 20 offers/h, 60 counters/h, 20 viewing requests/h, 30 AI explains/h |
| SR-22 | M | Public `GET /v2/listings/:id/score?businessType=<anything>` ran an AI call + traffic call + stored a row per new value, also for draft listings; `traffic` and `scans?all=true` exposed non-public listings | **Fixed** `modules/v2/insights/*`: taxonomy slug required, public statuses (or manager), 30 fresh computations/h per IP, unready scans for managers only |
| SR-23 | L | Offer withdraw/reject raced with accept (no status guard) | **Fixed** conditional updates (`offers.service.ts`) |
| SR-24 | L | Liveness confirm links were reusable forever and could mark any listing rented/sold | **Fixed** `listings.service.ts`: single use, 30 days, active/stale listings only |
| SR-25 | M | Listing PATCH: material change on a `stale` listing skipped moderation (stale → active); `projectId` of another org's project; agency listing claiming "owner" | **Fixed** `listings.service.ts` |
| SR-26 | M | `x-api-key` (and PSP signatures) written to request logs; Swagger UI public in production | **Fixed** `app.module.ts` redaction, `main.ts` docs only outside production (or `API_DOCS_PUBLIC=true`) |

### CRM (org isolation holds; agent-level scoping gaps)
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-27 | H | E-sign link was `mock-sign-<documentId>`: anyone who saw a document id could sign as the client | **Fixed (partial)** `integrations/esign/esign.ts`, `crm/documents/*`: 256-bit random ref per send, 14-day expiry, single use, per-IP rate limit. Remaining: ref not wiped after signing (page reloads by ref); seed still has `mock-sign-1/2` (inert) |
| SR-28 | H | Inbox ignored agent visibility (all conversations, phones, reply as agency) | **Fixed** `crm/inbox/inbox.service.ts` |
| SR-29 | H | Activity timeline (and call log) read/wrote any contact/deal of the org | **Fixed** `crm/shared/crm.controller.ts`, `crm/calls/calls.controller.ts` via `crm/shared/crm-access.ts` |
| SR-30 | M | Agents could attach other agents' contacts/deals to their records and read PII; contact detail listed all deals | **Fixed** deals, tasks, viewings, presentations, sequences |
| SR-31 | M | Documents unscoped for agents; deal value/commission leaked to roles without `finance.view` | **Fixed** `crm/documents/documents.service.ts` |
| SR-32 | M | Presentations/deals could embed other orgs' non-public listings (shown on public token page) | **Fixed** |
| SR-33 | M | CSV exports: formula injection (`= + - @ \t \r`) | **Fixed** `crm/imports/spreadsheet.ts` (`'` prefix, stripped again on import) |
| SR-34 | M | Public XML feeds published agent/owner personal phones; feed URL is the org UUID | **Partial**: only the organization phone is published. Remaining: secret, rotatable feed token (needs a migration) |
| SR-35 | M | ICS calendar token not revocable, no membership check | **Fixed**: domain-separated HMAC key, inactive member → 404 (existing calendar links change once) |
| SR-36 | L | Channel webhook secret compared with `!==`; `simulate` live in production; 12-byte portal tokens, merged contacts kept live tokens; KPI endpoint without `analytics.view` | **Fixed** (new portal tokens 32 bytes; CRM dashboard hides KPIs for assistants: `apps/crm/src/app/(workspace)/dashboard/page.tsx`) |

### Personal data (PDP law)
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-37 | M | Account deletion left personal data in demand requests (publicly listed with phone), service providers, review author names, leases, prebookings, viewings notes, compare lists, active memberships, session IPs; export missed received offers, conversations, leases, escrow, orders, reviews, sessions — and included `telegram_link_token` | **Fixed** `modules/users/privacy.ts` (`anonymizeUser`, `exportUserData`). Kept on purpose: counterpart's copy of messages/offers (sender shown as deleted user), invoices/ledger (accounting law), consents (proof), audit log |
| SR-38 | M | Broker phone reveal was not logged; service-provider phones went to every logged-in user without log or cap | **Fixed**: `audit_log` `reveal_phone` rows; provider phone capped at 60 disclosures/h per user |
| SR-39 | L | Telegram webhook accepted anyone; messenger mock-confirm endpoints live in production | **Fixed**: `TELEGRAM_WEBHOOK_SECRET` (required in production, `x-telegram-bot-api-secret-token`), mocks 404 in production |

### Availability and dependencies
| # | sev | finding | status / fix |
|---|---|---|---|
| SR-40 | H | **Pool deadlock**: helpers used `dbs.db` (a second pool connection) inside RLS transactions (`crm/deals` board, contact duplicates, CRM viewing create). 20 concurrent deal-board requests hung the API until restart | **Fixed**: those queries use the transaction; `DbService` sets `idle_in_transaction_session_timeout = 15 s` (`packages/db/src/client.ts`) so any future nested use fails fast instead of freezing the API |
| SR-41 | H | `pnpm audit --prod`: sharp < 0.35.4 (libvips/libheif CVEs), multer 2.2.0 (3 DoS advisories, pinned by `@nestjs/platform-express`) | **Fixed**: sharp `^0.35.4`, `pnpm-workspace.yaml` override `multer: ^2.3.0` (2.4.0). Now 0 high/critical; remaining moderate: `uuid` via exceljs (buffer API not used), `decode-uri-component` via expo-router (apps/mobile) |

Checked and OK: global default-deny guard and `@Roles` on every admin controller; RLS on all 17 org tables with `dbs.org`/`dbs.system` usage filtered by org or token; refresh rotation + family revocation, logout/logout-all, ban revokes sessions; cookie flags (httpOnly, SameSite=Lax, Secure in prod); CORS allow-list; API keys (192-bit, SHA-256, scopes, manager-only org keys); no SQL built from user strings (enum sort maps, parameterised `sql`); feed/ICS escaping; no SSRF (competitor checks are mock, Sheets import rebuilds a fixed `docs.google.com` URL); problem+json without stacks; react-markdown renders without raw HTML (`apps/web` permits/pages, admin CMS); listing JSON-LD escapes `<` (`apps/web/src/components/portal/seo.tsx`; pricing FAQ JSON-LD is static copy); offer contract PDFs only via the participant endpoint.

### Remaining risks (owners / follow-ups)
1. Access tokens stay valid up to 15 min after ban, deletion, logout-all or role change (no denylist). Mitigation option: Redis set of revoked session ids checked in `AuthGuard`.
2. S3 direct uploads: switch to presigned POST with `content-length-range` + fixed `Content-Type` (SR-19); serve R2 media from a separate cookieless domain.
3. Feed secret token (SR-34) and e-sign ref wipe after signing (SR-27) need a migration.
4. Profile e-mails are unverified: they can squat an address (Google sign-up then gets 409). Add an e-mail verification flow before using e-mail for anything security-relevant.
5. OTP verify limit per phone lets an attacker lock a victim out for 15 min (accepted; Turnstile is mandatory in production).
6. `/v1/admin/*` is reachable through `api.` and `lokacia.ge/api` — the IP allow-list covers only the `admin.` UI host (Caddy rule needed).
7. API key limits are copied at creation/subscription change; a banned owner's keys stay valid until revoked.
8. Moderators can read offer threads/contract PDFs and viewing phones for support; not separately logged (accepted, audit on mutations only).
9. `crm_contacts` rows created by agencies about a deleted portal user are not erased (agencies are separate controllers of that data) — the DPO process should notify the orgs.
10. Rate limits fall back to per-pod memory when Redis is down (see S13).
11. Nonce-based CSP for Next apps still open (S2).

## Performance verification (2026-09-17)
- **Lighthouse (mobile, devtools throttling: slow 4G, 4× CPU)** on a production build: `/` perf 96 · a11y 100 · SEO 100 · LCP 2.20 s; `/search` 94 · 98 · 100 · LCP 2.42 s; `/listings/:slug` 95 · 97 · 100 · LCP 2.19 s. `infra/lighthouse/lighthouserc.json` now uses devtools throttling (lantern simulation overestimated text LCP ~2×).
- Fixes that got there: FiraGO subset to Georgian+Latin (≈45 KB/weight, Cyrillic split into a lazily used family), placeholder photos served as WebP variants (480/960/1600) with in-memory render cache, mobile gallery first image `fetchpriority=high`.
- **k6** (`infra/k6`, 50 VUs, `lokacia_load` DB ≈40 000 active listings, production API build): search p95 39 ms / p99 74 ms, map p95 43 ms, listing detail p95 22 ms, similar p95 17 ms, 0 % errors — all thresholds pass.

## Beta / demo environment
`SEED_DATABASE_URL=postgres://…/lokacia_beta pnpm demo:beta` migrates and seeds a separate database with 50+ brokers across agencies and 400 spaces (override `SEED_BROKERS`, `SEED_LISTINGS`). Real broker data is imported per agency through CRM → „იმპორტი და ექსპორტი“ (Excel/CSV/Google Sheets with column mapping); `infra/seed/spaces-import.example.csv` is the template for bulk space imports.
