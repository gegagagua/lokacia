# Roadmap — 0 → 100% (v1.0 + v2.0)

Progress tracker. Work top to bottom. Tick `[x]` only when lint, typecheck and tests pass.
Feature references: `P#` = portal feature, `C#` = CRM feature, `V#` = v2.0 feature (see PRODUCT.md).

---
# PART A — v1.0

## Phase 0 — Repository bootstrap
- [x] pnpm + Turborepo monorepo with the layout from ARCHITECTURE.md; TS strict; shared eslint/prettier/tsconfig in `packages/config`
- [x] `infra/docker-compose.yml`: postgis 16, redis 7, meilisearch, minio, imgproxy, mailpit; healthchecks
- [x] `apps/api` NestJS skeleton: config module (Zod-validated env), health endpoint, problem+json errors, OpenAPI at `/v1/docs`, pino logging
- [ ] `apps/web`, `apps/crm`, `apps/admin` Next.js skeletons with next-intl (`ka` default, `en`/`ru` placeholders)
- [x] `packages/db` Drizzle setup, migration + seed scripts
- [ ] Vitest, Supertest (Testcontainers or compose DB), Playwright configured; one passing test each
- [x] `pnpm check:ka` script (Georgian script validator for `messages/ka.json`)
- [x] GitHub Actions: install, lint, typecheck, test, build; e2e on main
- [x] `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/HUMAN_TODO.md` created
**Done when:** `docker compose up -d && pnpm dev` runs all apps; CI green.

## Phase 1 — Design system & brand
- [ ] Tokens (light/dark) from BRAND.md in `packages/ui/tokens.css` + Tailwind preset; contrast test
- [ ] Noto Sans Georgian via next/font; type scale utilities; tabular-nums
- [ ] Logo SVG component (mark, wordmark, lockup) + favicon set
- [ ] All components listed in BRAND.md with Storybook stories and a11y addon passing
- [ ] `SpacePlan` signature component (dimension lines, m², ceiling, kW)
- [ ] MapLibre custom style JSON (plaster/green/blue/yellow) + `MapView` with pin-drop animation (reduced-motion safe)
- [ ] Portal shell: header, footer, theme toggle, language switcher (ka only active)
**Done when:** Storybook builds; a11y checks pass; dark mode works on every component.

## Phase 2 — Auth, users, organizations
- [ ] Schema: users, tenant_profiles, organizations, memberships, audit_log, settings
- [ ] SMS OTP (adapter + mock), Google OAuth, JWT access + rotating refresh cookie, logout-all
- [ ] Roles & permission guard; org context + RLS policy helper; cross-org denial test
- [ ] Profile & tenant profile screens (P20)
- [ ] Agency/developer org creation, invite members by phone, role change
- [ ] Audit interceptor writing audit_log for all mutations
- [ ] Rate limit + Turnstile on OTP
**Done when:** user can sign up by phone, create an agency, invite an agent; e2e passes.

## Phase 3 — Taxonomy, listings, passport, media
- [ ] Seed business types with `filter_config`, districts for Tbilisi (polygons), utility coefficients
- [ ] Listings schema + lifecycle state machine + passport (P2) + history (P10) + transfer equipment (P11)
- [ ] Multi-step "ფართის გამოქვეყნება" wizard: type → location (map pin, address) → passport (fields by business type) → media → price → review
- [ ] Media upload to S3 via presigned URLs; BullMQ processing (imgproxy variants, EXIF strip); floor plan & 360° kinds (P15 media part)
- [ ] Listing page (SSR): gallery, SpacePlan, SpecRows, history warning, owner/broker badge + commission (P5), phone reveal (rate-limited, logged)
- [ ] Owner verification upload flow (P5)
- [ ] Monthly cost calculator widget (P9)
- [ ] Off-plan: projects entity, completion date, pre-booking request (P8)
- [ ] Short-term: pricing periods + availability calendar (P21)
**Done when:** owner can publish a full listing that appears (after moderation) on its SSR page.

## Phase 4 — Admin & moderation
- [ ] `apps/admin`: moderation queue (approve/reject with reason), owner verification review
- [ ] Users/orgs management, ban, impersonate (audited)
- [ ] Settings editor: prices, liveness days, launch promo date
- [ ] CMS: permits checklist per business type (P12), static pages
- [ ] Taxonomy editor (business types, filter configs)
**Done when:** moderator can process the queue end to end; all actions in audit_log.

## Phase 5 — Search, map, location analytics
- [ ] Meilisearch index for active listings (sync via queue on change); facets; geo radius & bounding box
- [ ] Search page: business-type-driven filters (P1), URL state, list/map split view, sorting, cursor pagination
- [ ] OSM POI import script (competitors by business type, transport, schools, business centers) + district stats job
- [ ] `/v1/geo/insights` + insights panel on listing page (P3)
- [ ] Price recommendation service (P18) used in wizard
- [ ] Price & vacancy district map (P23 free part)
- [ ] "Only from owners" filter (P5)
**Done when:** search p95 < 300 ms on 50k seeded listings; e2e filter → map → listing passes.

## Phase 6 — Liveness, alerts, favorites
- [ ] Liveness scheduler: every N days send confirm link (SMS/Telegram/email), hide after 72 h, "confirmed X days ago" label (P4)
- [ ] Notifications module: channel router, templates (ka), user preferences, unsubscribe
- [ ] Telegram bot + Viber bot adapters (link account via deep link)
- [ ] Saved searches & instant alerts within 1 min of publish (P7)
- [ ] Favorites, comparison table (≤6), read-only share link (P14)
- [ ] Demand board: post, browse, expiry, suggested matches, contact (P6)
**Done when:** publishing a listing triggers a matching alert in the mock channel in < 1 min (integration test).

## Phase 7 — Transactions: viewings, offers, chat, contracts
- [ ] Availability slots, viewing booking (onsite/video link), ICS, reminders (P15)
- [ ] Chat over WebSocket with attachments, read receipts, unread counters
- [ ] Offers with counter-offers, statuses, notifications; tenant profile attached (P16, P20)
- [ ] Contract template PDF from accepted offer (P17); legal text placeholder listed in HUMAN_TODO
- [ ] Business transfer flow end to end (P11)
**Done when:** tenant books viewing → chats → offers → owner counters → accepts → PDF generated (e2e).

## Phase 8 — AI features
- [ ] `packages/ai` wrapper: model from env, retries, timeouts, token logging, prompt files, eval fixtures
- [ ] NL search parser → Zod filter object, chips UI, fallback, cache (P13); eval set of 50 Georgian queries ≥ 90% correct
- [ ] Listing description generator ka/en/ru (C11 text part), editable before save
- [ ] Rule-based listing advice + optional AI explanation (P19)
**Done when:** evals pass in CI with a recorded/mock client; live key only in manual run.

## Phase 9 — Statistics & services marketplace
- [ ] Listing events ingestion (view/reveal/save/share), daily aggregation job
- [ ] Owner stats dashboard with advice (P19)
- [ ] Services marketplace: provider profiles, categories, request-a-quote, order status, commission ledger (P24)
**Done when:** owner dashboard shows correct numbers for seeded events (test).

## Phase 10 — CRM core (`apps/crm`)
- [ ] CRM shell (PWA manifest, sidebar, command palette), org switcher
- [ ] Contacts with dedup merge (C1)
- [ ] Requirements on contacts + automatic matching on new listings (C2)
- [ ] Configurable pipeline + drag-and-drop kanban, won/lost (C3)
- [ ] Viewing calendar, Google Calendar sync, day route ordering (C4)
- [ ] Tasks & reminders (push + Telegram) (C5)
- [ ] Unified inbox with portal chat + WhatsApp/Viber/Telegram adapters (C6)
- [ ] Click-to-call + call log + note prompt (C7)
- [ ] Client portal via tokenized link with like/dislike (C8)
**Done when:** agent works a lead from contact to closed deal entirely in CRM (e2e).

## Phase 11 — CRM listings & marketing
- [ ] One-click publish + XML feed (C9)
- [ ] Branded presentation link/PDF with open tracking (C10)
- [ ] Photo enhancement pipeline (C11 image part)
- [ ] Broker public profile mini-site `/broker/:slug` with reviews (C12)
- [ ] Weekly owner report email/Telegram (C13)
- [ ] Liveness automation for org listings (C14)
- [ ] Competitor monitoring: tracked URLs + price change log (adapter) (C15)
- [ ] Follow-up sequences engine (C16)
**Done when:** feed validates against XSD; sequence runs on schedule in integration test.

## Phase 12 — CRM team, finance, analytics, mobile
- [ ] Roles manager/agent/assistant; lead distribution round-robin / by district (C17)
- [ ] Commission calculator & deal finance (C18)
- [ ] Lead sources & ROI (C19)
- [ ] KPI dashboard (C20)
- [ ] Documents, versions, e-sign adapter (C21)
- [ ] Co-brokering shares with commission split (C22)
- [ ] PWA offline: add listing on-site (photos, GPS, voice note) with background sync (C23)
- [ ] Excel/Google Sheets import with column mapping; full data export; audit viewer (C24)
**Done when:** all 24 CRM features have passing tests; Lighthouse PWA check passes.

## Phase 13 — Billing & payments
- [ ] Plans from settings; subscriptions per agent/org; VIP listing purchase; developer & analytics report products (P23 paid part)
- [ ] Payment provider interface; mock, BOG, TBC, PSP adapters (sandbox); webhooks with signature + idempotency
- [ ] Invoices (PDF), receipts, failed payment retries, grace period, downgrade
- [ ] Launch promo: everything free until `launch_promo_until`
- [ ] Admin revenue view
**Done when:** full checkout → webhook → subscription active flow passes against the mock provider.

## Phase 14 — SEO, performance, security, observability
- [ ] Landing pages: district × business type, business type, district; sitemap index; robots; canonical; schema.org
- [ ] OG images per listing (generated)
- [ ] Lighthouse CI budgets (LCP < 2.5 s, ≥ 90) on key pages
- [ ] Security: CSP, HSTS, rate limits review, personal-data export/delete endpoints, consent log
- [ ] Sentry, OpenTelemetry traces, Grafana dashboards, uptime checks
- [ ] Backups + PITR config, documented restore drill
- [ ] Load test (k6) on search and listing pages
**Done when:** Lighthouse CI and k6 thresholds pass.

## Phase 15 — Beta & launch readiness
- [ ] Production Dockerfiles, deploy pipeline (staging + prod), migrations on deploy, zero-downtime
- [ ] Seed/demo mode for beta (50 brokers, 300+ spaces import tooling)
- [ ] Feedback widget, analytics events (privacy-friendly)
- [ ] Full regression e2e suite; accessibility audit (axe) on all public pages
- [ ] Launch checklist in `docs/LAUNCH.md`
**Done when:** staging passes full suite; v1.0 tagged.

---
# PART B — v2.0

## Phase 16 — Foot traffic & location score
- [ ] Traffic provider interface + mock hourly dataset; ingestion into `traffic_samples` (V1)
- [ ] Hourly flow chart on listing & map layer
- [ ] Location score 0–100 per business type with explainable components; AI summary (V2)
- [ ] Score shown on cards, filter/sort by score

## Phase 17 — Digital contracts & escrow
- [ ] Online contract signing flow on top of documents module (V3)
- [ ] Escrow state machine via PSP adapter: pending → funded → released/refunded/disputed; admin dispute tools
- [ ] Ledger with double-entry records and reconciliation job

## Phase 18 — Online rent payments
- [ ] Rent schedules, monthly invoices, autopay (V4)
- [ ] Late notices, penalties config, receipts
- [ ] Accounting export CSV/XLSX

## Phase 19 — 3D tours & floor plans
- [ ] Scan upload format support (e.g. USDZ/GLB/OBJ + point data) and web 3D viewer (three.js) (V5)
- [ ] Floor-plan generation from scan → SVG plan feeding `SpacePlan`
- [ ] Mobile LiDAR capture handled in Phase 21

## Phase 20 — Analytics API & market reports
- [ ] API keys, scopes, rate limits, usage metering, billing plans (V6)
- [ ] `/v1/public/*` endpoints: district stats, price index, vacancy, traffic, scores
- [ ] Generated PDF market reports; developer portal with docs

## Phase 21 — Mobile apps (`apps/mobile`, Expo)
- [ ] Expo Router app sharing `packages/contracts`; auth by OTP (V7)
- [ ] Map search, listing page, favorites, alerts via push (Expo Notifications)
- [ ] Chat, viewings, offers
- [ ] Broker mode: add listing on-site, camera, GPS, voice note; LiDAR capture on supported iPhones (native module) → Phase 19 pipeline
- [ ] EAS build profiles; store metadata listed in HUMAN_TODO

## Phase 22 — Regions & languages
- [ ] Batumi, Kutaisi, Rustavi districts + POI import (V8)
- [ ] Full `en` and `ru` translations, localized slugs, hreflang, language-specific sitemaps
- [ ] Currency display USD/EUR (rates job), listing text per locale

## Phase 23 — Property management
- [ ] Owner portfolio view, tenants, leases (V9)
- [ ] Maintenance requests with statuses and photos
- [ ] Utilities tracking and tenant communication

## Phase 24 — Finance marketplace
- [ ] Partner products (fit-out loan, leasing, insurance) configured in admin (V10)
- [ ] Application flow with consent, partner handoff adapter, status webhooks
- [ ] Commission tracking per approved application

## Phase 25 — v2.0 hardening & release
- [ ] Regression + load tests for new modules; security review of payments/escrow
- [ ] Docs updated; v2.0 tagged
**Done when:** all boxes in this file are ticked. 🎯 100%
