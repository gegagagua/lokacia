---
name: lokacia-run-and-verify
description: Start, seed, test and visually verify the lokacia.ge stack locally (ports, demo accounts, commands, browser checks). Use when running the app, reproducing a bug, or confirming a feature works end to end.
---

# Run & verify locally

Machine specifics: no Docker; Homebrew Postgres 17 (+PostGIS in schema `extensions`) and Redis run as brew services. Ports 3000/3001 belong to other projects — lokacia uses **web 3100, crm 3101, admin 3102, api 4000**.

```bash
pnpm i
pnpm db:migrate && pnpm db:seed          # SEED_LISTINGS=50000 for load tests
pnpm --filter @lokacia/contracts build && pnpm --filter @lokacia/db build && pnpm --filter @lokacia/ai build
cd apps/api && pnpm build && node dist/src/main.js     # or pnpm dev (swc watch)
cd apps/web && pnpm dev                                 # http://localhost:3100
pnpm dev                                                # everything via turbo
```
- API docs: http://localhost:4000/v1/docs ; health: /v1/health
- Login: any demo phone + OTP `123456` (dev only). The login page lists demo accounts.

| role | phone |
|---|---|
| admin | +995500000001 |
| moderator | +995500000002 |
| owner (listings, offers, leases) | +995500000003 |
| agency manager — ქალაქის ფართები (city-spaces) | +995500000004 |
| broker/agent — city-spaces | +995500000005 |
| tenant business | +995500000006 |
| developer (off-plan projects) | +995500000007 |
| service provider (მოწყობა პლიუს) | +995500000008 |
| agency assistant | +995500000009 |
| agency manager — business-lokacia | +995500000010 |

Demo tokens: compare share `demo-compare-cafe`, client portal `demo-client-portal`, presentation `demo-presentation`, analytics API key `lk_demo_analytics_key_123456`.

Tests: `pnpm test` (turbo, sequential) · API only `cd apps/api && npx vitest run` · e2e `pnpm test:e2e` (Playwright, needs running apps) · `pnpm check:ka`.

Browser verification: open the page, check console for errors, toggle dark theme (header moon icon), resize to 375px. Screens must have no horizontal scroll and all text Georgian.

If a port is busy: `lsof -nP -iTCP:<port> -sTCP:LISTEN` — only stop processes started for lokacia.
