# lokacia.ge

Georgia's commercial-space portal (offices, retail, warehouses, restaurant spaces) with a built-in broker CRM.
Specs live in `docs/` (PRODUCT, ARCHITECTURE, BRAND, ROADMAP). Standing instructions for agents: `CLAUDE.md`.

## Apps
| app | url (dev) | what |
|---|---|---|
| `apps/web` | http://localhost:3100 | public portal + owner/tenant account |
| `apps/crm` | http://localhost:3101 | broker workspace (PWA) |
| `apps/admin` | http://localhost:3102 | moderation, settings, billing, v2 tools |
| `apps/api` | http://localhost:4000 (`/v1/docs`) | NestJS REST + WebSocket |

Packages: `ui` (design system + Storybook), `contracts` (Zod), `db` (Drizzle schema, migrations, seed), `ai` (Claude wrapper + rule fallback), `config`.

## Quick start
```bash
pnpm i
# Postgres 16+/PostGIS and Redis: either `docker compose up -d` or local services (see infra/postgres/init.sql)
cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm dev
```
Log in with any demo phone and OTP code **123456** (development only):

| role | phone |
|---|---|
| admin | +995 500 000 001 |
| moderator | +995 500 000 002 |
| owner | +995 500 000 003 |
| agency manager (ქალაქის ფართები) | +995 500 000 004 |
| broker | +995 500 000 005 |
| tenant business | +995 500 000 006 |
| developer | +995 500 000 007 |
| service provider | +995 500 000 008 |

## Checks
`pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm check:ka` · `pnpm build`

External services (SMS, banks, Telegram, Claude API, MapTiler…) run on mocks until keys are provided — see `docs/HUMAN_TODO.md`.
