# Roadmap — 0 → 100% (v1.0 + v2.0)

Progress tracker. Work top to bottom. Tick `[x]` only when lint, typecheck and tests pass.
Feature references: `P#` = portal feature, `C#` = CRM feature, `V#` = v2.0 feature (see PRODUCT.md).

---
# PART A — v1.0

## Phase 0 — Repository bootstrap
- [x] pnpm + Turborepo monorepo with the layout from ARCHITECTURE.md; TS strict; shared eslint/prettier/tsconfig in `packages/config`
- [x] `infra/docker-compose.yml`: postgis 16, redis 7, meilisearch, minio, imgproxy, mailpit; healthchecks
- [x] `apps/api` NestJS skeleton: config module (Zod-validated env), health endpoint, problem+json errors, OpenAPI at `/v1/docs`, pino logging
- [x] `apps/web`, `apps/crm`, `apps/admin` Next.js skeletons with next-intl (`ka` default, `en`/`ru` placeholders)
- [x] `packages/db` Drizzle setup, migration + seed scripts
- [x] Vitest, Supertest (Testcontainers or compose DB), Playwright configured; one passing test each
- [x] `pnpm check:ka` script (Georgian script validator for `messages/ka.json`)
- [x] GitHub Actions: install, lint, typecheck, test, build; e2e on main
- [x] `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/HUMAN_TODO.md` created
**Done when:** `docker compose up -d && pnpm dev` runs all apps; CI green.

## Phase 1 — Design system & brand
- [x] Tokens (light/dark) from BRAND.md in `packages/ui/tokens.css` + Tailwind preset; contrast test
- [x] Noto Sans Georgian via next/font; type scale utilities; tabular-nums
- [x] Logo SVG component (mark, wordmark, lockup) + favicon set
- [x] All components listed in BRAND.md with Storybook stories and a11y addon passing
- [x] `SpacePlan` signature component (dimension lines, m², ceiling, kW)
- [x] MapLibre custom style JSON (plaster/green/blue/yellow) + `MapView` with pin-drop animation (reduced-motion safe)
- [x] Portal shell: header, footer, theme toggle, language switcher (ka only active)
**Done when:** Storybook builds; a11y checks pass; dark mode works on every component.

## Phase 2 — Auth, users, organizations
- [x] Schema: users, tenant_profiles, organizations, memberships, audit_log, settings
- [x] SMS OTP (adapter + mock), Google OAuth, JWT access + rotating refresh cookie, logout-all
- [x] Roles & permission guard; org context + RLS policy helper; cross-org denial test
- [x] Profile & tenant profile screens (P20)
- [x] Agency/developer org creation, invite members by phone, role change
- [x] Audit interceptor writing audit_log for all mutations
- [x] Rate limit + Turnstile on OTP
**Done when:** user can sign up by phone, create an agency, invite an agent; e2e passes.

## Phase 3 — Taxonomy, listings, passport, media
- [x] Seed business types with `filter_config`, districts for Tbilisi (polygons), utility coefficients
- [x] Listings schema + lifecycle state machine + passport (P2) + history (P10) + transfer equipment (P11)
- [x] Multi-step "ფართის გამოქვეყნება" wizard: type → location (map pin, address) → passport (fields by business type) → media → price → review
- [x] Media upload to S3 via presigned URLs; BullMQ processing (imgproxy variants, EXIF strip); floor plan & 360° kinds (P15 media part)
- [x] Listing page (SSR): gallery, SpacePlan, SpecRows, history warning, owner/broker badge + commission (P5), phone reveal (rate-limited, logged)
- [x] Owner verification upload flow (P5)
- [x] Monthly cost calculator widget (P9)
- [x] Off-plan: projects entity, completion date, pre-booking request (P8)
- [x] Short-term: pricing periods + availability calendar (P21)
**Done when:** owner can publish a full listing that appears (after moderation) on its SSR page.

## Phase 4 — Admin & moderation
- [x] `apps/admin`: moderation queue (approve/reject with reason), owner verification review
- [x] Users/orgs management, ban, impersonate (audited)
- [x] Settings editor: prices, liveness days, launch promo date
- [x] CMS: permits checklist per business type (P12), static pages
- [x] Taxonomy editor (business types, filter configs)
**Done when:** moderator can process the queue end to end; all actions in audit_log.

## Phase 5 — Search, map, location analytics
- [x] Meilisearch index for active listings (sync via queue on change); facets; geo radius & bounding box
- [x] Search page: business-type-driven filters (P1), URL state, list/map split view, sorting, cursor pagination
- [x] OSM POI import script (competitors by business type, transport, schools, business centers) + district stats job
- [x] `/v1/geo/insights` + insights panel on listing page (P3)
- [x] Price recommendation service (P18) used in wizard
- [x] Price & vacancy district map (P23 free part)
- [x] "Only from owners" filter (P5)
**Done when:** search p95 < 300 ms on 50k seeded listings; e2e filter → map → listing passes.

## Phase 6 — Liveness, alerts, favorites
- [x] Liveness scheduler: every N days send confirm link (SMS/Telegram/email), hide after 72 h, "confirmed X days ago" label (P4)
- [x] Notifications module: channel router, templates (ka), user preferences, unsubscribe
- [x] Telegram bot + Viber bot adapters (link account via deep link)
- [x] Saved searches & instant alerts within 1 min of publish (P7)
- [x] Favorites, comparison table (≤6), read-only share link (P14)
- [x] Demand board: post, browse, expiry, suggested matches, contact (P6)
**Done when:** publishing a listing triggers a matching alert in the mock channel in < 1 min (integration test).

## Phase 7 — Transactions: viewings, offers, chat, contracts
- [x] Availability slots, viewing booking (onsite/video link), ICS, reminders (P15)
- [x] Chat over WebSocket with attachments, read receipts, unread counters
- [x] Offers with counter-offers, statuses, notifications; tenant profile attached (P16, P20)
- [x] Contract template PDF from accepted offer (P17); legal text placeholder listed in HUMAN_TODO
- [x] Business transfer flow end to end (P11)
**Done when:** tenant books viewing → chats → offers → owner counters → accepts → PDF generated (e2e).

## Phase 8 — AI features
- [x] `packages/ai` wrapper: model from env, retries, timeouts, token logging, prompt files, eval fixtures
- [x] NL search parser → Zod filter object, chips UI, fallback, cache (P13); eval set of 50 Georgian queries ≥ 90% correct
- [x] Listing description generator ka/en/ru (C11 text part), editable before save
- [x] Rule-based listing advice + optional AI explanation (P19)
**Done when:** evals pass in CI with a recorded/mock client; live key only in manual run.

## Phase 9 — Statistics & services marketplace
- [x] Listing events ingestion (view/reveal/save/share), daily aggregation job
- [x] Owner stats dashboard with advice (P19)
- [x] Services marketplace: provider profiles, categories, request-a-quote, order status, commission ledger (P24)
**Done when:** owner dashboard shows correct numbers for seeded events (test).

## Phase 10 — CRM core (`apps/crm`)
- [x] CRM shell (PWA manifest, sidebar, command palette), org switcher
- [x] Contacts with dedup merge (C1)
- [x] Requirements on contacts + automatic matching on new listings (C2)
- [x] Configurable pipeline + drag-and-drop kanban, won/lost (C3)
- [x] Viewing calendar, Google Calendar sync, day route ordering (C4)
- [x] Tasks & reminders (push + Telegram) (C5)
- [x] Unified inbox with portal chat + WhatsApp/Viber/Telegram adapters (C6)
- [x] Click-to-call + call log + note prompt (C7)
- [x] Client portal via tokenized link with like/dislike (C8)
**Done when:** agent works a lead from contact to closed deal entirely in CRM (e2e).

## Phase 11 — CRM listings & marketing
- [x] One-click publish + XML feed (C9)
- [x] Branded presentation link/PDF with open tracking (C10)
- [x] Photo enhancement pipeline (C11 image part)
- [x] Broker public profile mini-site `/broker/:slug` with reviews (C12)
- [x] Weekly owner report email/Telegram (C13)
- [x] Liveness automation for org listings (C14)
- [x] Competitor monitoring: tracked URLs + price change log (adapter) (C15)
- [x] Follow-up sequences engine (C16)
**Done when:** feed validates against XSD; sequence runs on schedule in integration test.

## Phase 12 — CRM team, finance, analytics, mobile
- [x] Roles manager/agent/assistant; lead distribution round-robin / by district (C17)
- [x] Commission calculator & deal finance (C18)
- [x] Lead sources & ROI (C19)
- [x] KPI dashboard (C20)
- [x] Documents, versions, e-sign adapter (C21)
- [x] Co-brokering shares with commission split (C22)
- [x] PWA offline: add listing on-site (photos, GPS, voice note) with background sync (C23)
- [x] Excel/Google Sheets import with column mapping; full data export; audit viewer (C24)
**Done when:** all 24 CRM features have passing tests; Lighthouse PWA check passes.

## Phase 13 — Billing & payments
- [x] Plans from settings; subscriptions per agent/org; VIP listing purchase; developer & analytics report products (P23 paid part)
- [x] Payment provider interface; mock, BOG, TBC, PSP adapters (sandbox); webhooks with signature + idempotency
- [x] Invoices (PDF), receipts, failed payment retries, grace period, downgrade
- [x] Launch promo: everything free until `launch_promo_until`
- [x] Admin revenue view
**Done when:** full checkout → webhook → subscription active flow passes against the mock provider.

## Phase 14 — SEO, performance, security, observability
- [x] Landing pages: district × business type, business type, district; sitemap index; robots; canonical; schema.org
- [x] OG images per listing (generated)
- [x] Lighthouse CI budgets (LCP < 2.5 s, ≥ 90) on key pages
- [x] Security: CSP, HSTS, rate limits review, personal-data export/delete endpoints, consent log
- [ ] Sentry, OpenTelemetry traces, Grafana dashboards, uptime checks
- [x] Backups + PITR config, documented restore drill
- [x] Load test (k6) on search and listing pages
**Done when:** Lighthouse CI and k6 thresholds pass.

## Phase 15 — Beta & launch readiness
- [ ] Production Dockerfiles, deploy pipeline (staging + prod), migrations on deploy, zero-downtime
- [x] Seed/demo mode for beta (50 brokers, 300+ spaces import tooling)
- [x] Feedback widget, analytics events (privacy-friendly)
- [x] Full regression e2e suite; accessibility audit (axe) on all public pages
- [x] Launch checklist in `docs/LAUNCH.md`
**Done when:** staging passes full suite; v1.0 tagged.

---
# PART B — v2.0

## Phase 16 — Foot traffic & location score
- [x] Traffic provider interface + mock hourly dataset; ingestion into `traffic_samples` (V1)
- [x] Hourly flow chart on listing & map layer
- [x] Location score 0–100 per business type with explainable components; AI summary (V2)
- [x] Score shown on cards, filter/sort by score

## Phase 17 — Digital contracts & escrow
- [x] Online contract signing flow on top of documents module (V3)
- [x] Escrow state machine via PSP adapter: pending → funded → released/refunded/disputed; admin dispute tools
- [x] Ledger with double-entry records and reconciliation job

## Phase 18 — Online rent payments
- [x] Rent schedules, monthly invoices, autopay (V4)
- [x] Late notices, penalties config, receipts
- [x] Accounting export CSV/XLSX

## Phase 19 — 3D tours & floor plans
- [x] Scan upload format support (e.g. USDZ/GLB/OBJ + point data) and web 3D viewer (three.js) (V5)
- [x] Floor-plan generation from scan → SVG plan feeding `SpacePlan`
- [ ] Mobile LiDAR capture handled in Phase 21

## Phase 20 — Analytics API & market reports
- [x] API keys, scopes, rate limits, usage metering, billing plans (V6)
- [x] `/v1/public/*` endpoints: district stats, price index, vacancy, traffic, scores
- [x] Generated PDF market reports; developer portal with docs

## Phase 21 — Mobile apps (`apps/mobile`, Expo)
- [x] Expo Router app sharing `packages/contracts`; auth by OTP (V7)
- [x] Map search, listing page, favorites, alerts via push (Expo Notifications)
- [x] Chat, viewings, offers
- [ ] Broker mode: add listing on-site, camera, GPS, voice note; LiDAR capture on supported iPhones (native module) → Phase 19 pipeline
- [x] EAS build profiles; store metadata listed in HUMAN_TODO

## Phase 22 — Regions & languages
- [x] Batumi, Kutaisi, Rustavi districts + POI import (V8)
- [x] Full `en` and `ru` translations, localized slugs, hreflang, language-specific sitemaps
- [x] Currency display USD/EUR (rates job), listing text per locale

## Phase 23 — Property management
- [x] Owner portfolio view, tenants, leases (V9)
- [x] Maintenance requests with statuses and photos
- [x] Utilities tracking and tenant communication

## Phase 24 — Finance marketplace
- [x] Partner products (fit-out loan, leasing, insurance) configured in admin (V10)
- [x] Application flow with consent, partner handoff adapter, status webhooks
- [x] Commission tracking per approved application

## Phase 25 — v2.0 hardening & release
- [x] Regression + load tests for new modules; security review of payments/escrow
- [ ] Docs updated; v2.0 tagged
**Done when:** all boxes in this file are ticked. 🎯 100%
