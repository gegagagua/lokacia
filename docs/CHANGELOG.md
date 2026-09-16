# Changelog

## 2026-09-17 — v1.0 build + v2.0 web features
- Phase 0: pnpm/Turborepo monorepo, TS strict, shared config, docker-compose, CI, check:ka, Drizzle schema for v1+v2 with Postgres RLS, rich Georgian demo seed.
- Phase 1: design tokens (light/dark, WCAG-tested), full component library with Storybook 10 + axe (0 violations), SpacePlan, MapView with pin-drop, favicons.
- Phases 2–3: OTP + rotating refresh auth, orgs/invites/roles, audit log, listings lifecycle, 7-step publishing wizard, media pipeline, SSR listing page with passport, history, cost calculator, verification, off-plan, short-term.
- Phases 4–9: admin moderation/users/settings/CMS/taxonomy, search (business-type filters, map split view, NL parser), location insights, district price map, liveness automation, alerts, favorites/compare, demand board, viewings + ICS, WebSocket chat, offers + contract PDF, AI descriptions & advice, stats, services marketplace.
- Phases 10–12: broker CRM app (all C1–C24) — contacts dedup, matching, kanban, calendar routes, inbox, client portal, feeds (XSD), presentations, sequences, team, KPI, documents/e-sign, co-brokering, PWA offline, import/export.
- Phase 13: billing with mock PSP, signed idempotent webhooks, invoices, grace/downgrade, launch promo, VIP, reports.
- Phases 14–15: landing pages, sitemap index, OG images, security headers, ops docs, backups/restore drill, feedback & analytics, e2e suite (64 tests incl. axe + SEO + mobile).
- Phases 16–20, 23–24: foot traffic + location score, escrow + ledger, rent payments, 3D tours, analytics API, property management, finance marketplace.
- Tests: 164 unit/integration (contracts 13, ai eval 1, ui 26, api 124) + 64 Playwright e2e — all green.
