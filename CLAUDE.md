# lokacia.ge — Claude Code project guide

lokacia.ge is Georgia's commercial-space portal (offices, retail, warehouses, restaurant spaces) with a built-in broker CRM.
This file is the standing instruction set. Read it at the start of every session.

## Source of truth
- `docs/PRODUCT.md` — every feature (v1.0 portal, v1.0 CRM, v2.0) with acceptance criteria.
- `docs/ARCHITECTURE.md` — stack, monorepo layout, modules, database schema, API, security.
- `docs/BRAND.md` — design tokens, typography, UI rules, Georgian copy rules.
- `docs/ROADMAP.md` — ordered phases with checkboxes. **This is the progress tracker.**

If docs conflict: ROADMAP > PRODUCT > ARCHITECTURE > BRAND. If something is unspecified, choose the simplest option that fits the architecture, then record the decision in `docs/DECISIONS.md` (create it if missing, one line per decision with date).

## Work loop (every session)
1. Open `docs/ROADMAP.md`, find the first phase with unchecked tasks.
2. Write a short plan for that phase (files, migrations, endpoints, screens). Do not skip ahead.
3. Implement task by task. After each task:
   - `pnpm lint && pnpm typecheck && pnpm test` must pass.
   - Tick the checkbox in `docs/ROADMAP.md`.
   - Commit: `feat(<module>): <what>` (Conventional Commits).
4. At the end of a phase: run the phase's "Done when" checks, run `pnpm build`, run e2e for touched flows, then write a 5–10 line summary in `docs/CHANGELOG.md`.
5. Continue to the next phase unless the user asked to stop after one phase.

Never mark a task done if tests fail or code is stubbed without saying so. If a task needs something only a human can provide (bank merchant contract, API key, legal text, data partner), build the adapter with a working mock/sandbox implementation, add the env var to `.env.example`, list it in `docs/HUMAN_TODO.md`, and move on.

## Stack (do not change without a DECISIONS entry)
- Monorepo: pnpm workspaces + Turborepo, TypeScript strict everywhere.
- `apps/web` Next.js (App Router) — public portal. `apps/crm` Next.js — broker workspace. `apps/admin` Next.js — moderation. `apps/api` NestJS. v2: `apps/mobile` Expo (React Native).
- PostgreSQL 16 + PostGIS + pg_trgm, Drizzle ORM, Meilisearch, Redis + BullMQ, Cloudflare R2 (S3 API; MinIO locally) + imgproxy, MapLibre GL + MapTiler.
- Tailwind CSS + Radix UI primitives, Lucide icons, Storybook for `packages/ui`.
- Validation: Zod schemas in `packages/contracts`, shared by API and frontends. API exposes OpenAPI.
- Auth: SMS OTP + Google OAuth, JWT access (15 min) + rotating refresh (httpOnly cookie).
- AI: Anthropic Claude API via `packages/ai` wrapper only.
- Tests: Vitest (unit), Supertest (API integration, real Postgres via Docker), Playwright (e2e).
- Local infra: `docker compose up` must start postgres/postgis, redis, meilisearch, minio, imgproxy, mailpit.

## Conventions
- IDs: uuid v7. Every table: `id, created_at, updated_at, deleted_at` (soft delete).
- Money: integer tetri (`price_minor`) + `currency` (GEL default). Area in m² as numeric(10,2).
- Tenant isolation: every CRM/org-owned table has `org_id`; enforce with PostgreSQL RLS **and** a NestJS guard. Write a test proving cross-org access fails.
- Geo: `geography(Point,4326)` for listings/POIs, `geography(MultiPolygon,4326)` for districts. Use GiST indexes.
- API routes under `/v1`, kebab-case paths, cursor pagination (`?cursor=&limit=`), errors as RFC 9457 problem+json.
- Background work goes through BullMQ queues, never inline in requests (notifications, image processing, feeds, liveness checks, AI calls > 2s).
- All external services behind interfaces in `apps/api/src/integrations/<name>` with `*.mock.ts` used in dev/test.
- UI language: Georgian (`ka`) is default and primary. Put every string in `messages/ka.json` (next-intl); add `en` and `ru` keys as empty placeholders from day one so v2 i18n is cheap.
- Georgian copy: plain, concrete, button says what it does ("ფართის გამოქვეყნება", not "გაგზავნა"). Never mix scripts inside a word. Validate Georgian strings contain only Georgian letters, digits and punctuation (script check in CI: `pnpm check:ka`).
- Accessibility: WCAG 2.2 AA, visible focus, dark mode from day one, `prefers-reduced-motion` respected.
- Performance budget on public pages: LCP < 2.5 s, Lighthouse ≥ 90 (mobile).
- Personal data: owner/broker phone is hidden until "ნომრის ჩვენება" click; log each reveal; rate-limit reveals.

## Commands (keep these working)
```
pnpm i
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm dev            # all apps
pnpm lint | pnpm typecheck | pnpm test | pnpm test:e2e | pnpm build
pnpm check:ka       # Georgian string script check
```

## Don'ts
- No stock photos, no heavy shadows, no gradients (see BRAND.md).
- No secrets in the repo. No Google Maps.
- Do not add a new dependency when an existing one covers it.
- Do not delete or rewrite docs/ROADMAP.md history; only tick boxes and append.
