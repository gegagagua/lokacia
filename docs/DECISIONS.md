# Decisions

One line per decision (date — decision — why).

- 2026-09-16 — TypeScript pinned to 6.0.x (not 7.x) — typescript-eslint supports `<6.1`; TS 7 native compiler breaks the lint toolchain.
- 2026-09-16 — NestJS 11 (docs) although 12 is out — follow ARCHITECTURE.md; upgrade later with its own decision.
- 2026-09-16 — Shared packages compile to CommonJS with `moduleResolution: Node10` (+ `ignoreDeprecations: "6.0"`) — avoids drizzle dual ESM/CJS type hazard and lets NestJS (CJS) consume them; Next apps transpile them.
- 2026-09-16 — PostGIS/pg_trgm live in schema `extensions`, DB `search_path = public, extensions` — the app role is non-superuser (RLS must apply), and `db:reset` can drop `public` without losing extensions.
- 2026-09-16 — Geography columns are generated from `lat`/`lng` (points) and `boundary` GeoJSON (districts) — writes stay plain numbers/JSON; GiST indexes on generated columns.
- 2026-09-16 — drizzle-kit quotes parameterised custom types; `scripts/fix-migrations.mjs` runs after `db:generate`.
- 2026-09-16 — RLS via `app_org_visible(org_id)` using `app.org_id` or explicit `app.bypass_rls = on` (system/admin/jobs); `withOrg()` / `withSystem()` helpers in `@lokacia/db`.
- 2026-09-16 — Local dev machine has no Docker: Homebrew Postgres 17 + PostGIS and Redis are used; `infra/docker-compose.yml` is still provided (PostGIS 16) for other machines/CI.
- 2026-09-16 — Search engine behind `SearchEngine` interface: `postgres` adapter (default, PostGIS + pg_trgm + btree indexes) and `meilisearch` adapter (`SEARCH_ENGINE=meilisearch`). Meilisearch binary unavailable locally.
- 2026-09-16 — Object storage behind `Storage` interface: `local` (files under `storage/`, served by API) default in dev; `s3` adapter for R2/MinIO.
- 2026-09-16 — Seed photos are generated SVG "architectural drawings" served by `GET /v1/media/placeholder/:kind/:seed.svg` — BRAND.md forbids stock photos; neutral placeholders in seeds.
- 2026-09-16 — Money filters in URLs are whole GEL (`priceMax=3000`); API/DB use tetri — human-readable shareable URLs.
- 2026-09-16 — Passport filter keys are camelCase passport fields; booleans must be true, numbers are minimums.
- 2026-09-16 — Frontends call the API through a same-origin rewrite `/api/v1/* → API_URL/v1/*`; access (15 min) and refresh (rotating, 30 d) tokens are httpOnly cookies — SSR pages can forward cookies, no tokens in JS.
- 2026-09-16 — Dev OTP: mock SMS adapter logs the code; in non-production `OTP_DEV_CODE` (default `123456`) is accepted for any phone — makes the demo testable without SMS.
