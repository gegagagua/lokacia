# Human TODO

Items that need a person (contracts, keys, legal text, partners). Each has a working mock in the codebase.

| # | item | env / place | mock in place |
|---|---|---|---|
| 1 | SMS provider contract + API key (OTP, liveness, sequences) | `SMS_PROVIDER`, `SMS_API_KEY` | `sms.mock.ts` logs messages, dev OTP code |
| 2 | Google OAuth client | `GOOGLE_CLIENT_ID/SECRET` | Google button hidden when empty |
| 3 | Telegram bot token, Viber bot token, WhatsApp Cloud token | `TELEGRAM_BOT_TOKEN`, `VIBER_BOT_TOKEN`, `WHATSAPP_CLOUD_TOKEN` | channel mocks write to `notifications` |
| 4 | Bank of Georgia / TBC merchant contracts, PSP | `PAYMENTS_PROVIDER`, `BOG_*`, `TBC_API_KEY`, `PSP_*` | mock provider with hosted checkout page + signed webhook |
| 5 | Anthropic API key for live AI | `ANTHROPIC_API_KEY`, `AI_MODEL` | rule-based parser + recorded fixtures |
| 6 | MapTiler key for vector basemap | `MAPTILER_KEY` | OSM raster tiles tinted to brand |
| 7 | Legal texts: terms, privacy, contract template, permits checklist review | admin → CMS | demo texts flagged "დემო-ტექსტი" |
| 8 | Real OSM POI import run (network) | `pnpm --filter @lokacia/api import:osm` | fake POIs in seed |
| 9 | Competitor monitoring: portal ToS/robots review before any scraping | `apps/api/src/integrations/competitors` | manual URL tracking + mock price checker |
| 10 | Foot-traffic data partner (mobile operator / sensors) | `FOOT_TRAFFIC_PROVIDER` | mock hourly dataset |
| 11 | E-signature provider | `ESIGN_PROVIDER` | mock signer |
| 12 | Google Calendar OAuth app | `GOOGLE_CALENDAR_CLIENT_ID` | ICS export/feed |
| 13 | Cloudflare Turnstile keys | `TURNSTILE_SECRET` | verification skipped when empty |
| 14 | Sentry DSN, OTLP endpoint, Grafana | `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` | no-op when empty |
| 15 | Finance partners (banks, leasing, insurance) agreements | admin → finance products | demo partners |
| 16 | App Store / Play Store accounts + store metadata (mobile V7) — see **Mobile apps (V7)** below | `apps/mobile/eas.json` (`submit.production`), `app.config.ts` | `ge.lokacia.app` configured; builds run once EAS project exists |
| 17 | Escrow: PSP nominal/escrow account agreement + refund API; lawyer-reviewed contract & escrow terms | `PAYMENTS_PROVIDER`, `modules/v2/escrow` | mock PSP, contract PDF flagged „დემო-ტექსტი“ |
| 18 | Rent autopay: PSP recurring (saved card / tokenized) payments contract | `BillingService.chargeOffSession` | mock settles instantly |
| 19 | FX rates source (National Bank of Georgia API) | `modules/v2/fx/fx.service.ts` (`FxProvider`) | deterministic mock rates job |
| 20 | Finance partner APIs + per-partner webhook secrets (derived from `PAYMENTS_WEBHOOK_SECRET` for now) | `modules/v2/finance` (`FinancePartnerAdapter`) | mock handoff + admin "simulate" |
| 21 | Company requisites (legal name, tax id, bank account) for invoices/receipts PDF | `billing/invoice-pdf.service.ts` | "დემო-რეკვიზიტები" |
| 22 | LiDAR capture / real scan provider (USDZ → plan needs a converter) | `modules/v2/insights/scans.service.ts` | GLB/GLTF/OBJ/ASCII-PLY bounds; USDZ uses passport dims |
| 17 | Lease/sale/transfer contract template legal text (P17) — replace demo clauses in the generated PDF, lawyer review | `apps/api/src/modules/offers/contract-pdf.service.ts` | PDF marked „დემო-ტექსტი“ with lawyer-consultation upsell |
| C1 | CRM document templates (exclusivity / act / lease) — lawyer-reviewed Georgian legal text; real e-sign provider contract | `apps/api/src/modules/crm/documents/templates.ts`, `integrations/esign` (`ESIGN_PROVIDER`) | demo text marked „დემო-ტექსტი“, `MockESign` + `/sign/:ref` page |
| C2 | WhatsApp Cloud / Viber / Telegram inbound webhook signatures for the CRM inbox | `crm/inbox` (`WHATSAPP_CLOUD_TOKEN`, `VIBER_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`) | dev header `x-lk-webhook: dev`, mock outbound |
| C3 | Web push VAPID keys + persisted push subscriptions; Google Calendar OAuth app | `crm/tasks` push, `crm/calendar` (`GOOGLE_CALENDAR_CLIENT_ID`) | push mock channel, `MockCalendarSync` + ICS feed |
| C4 | Competitor portal price checks must respect robots.txt / ToS of ss.ge, myhome.ge (or data partnership) | `integrations/competitors` | `MockCompetitorChecker` |

## Mobile apps (V7, `apps/mobile`)

| # | item | env / place | mock in place |
|---|---|---|---|
| M1 | Expo account + EAS project (`eas init`), set `EAS_PROJECT_ID` (push tokens, OTA updates) | `EAS_PROJECT_ID` (EAS env / shell), `app.config.ts` `extra.eas.projectId` | push registration skipped when no project id; web preview works |
| M2 | Apple Developer Program account (team id), App Store Connect app `ge.lokacia.app` (+ `.preview`, `.dev` for internal), `ascAppId`/`appleTeamId` in `eas.json` | `eas.json` → `submit.production.ios` | placeholders `SET_IN_HUMAN_TODO` |
| M3 | APNs key (.p8) uploaded to EAS (`eas credentials`) | EAS credentials (never in repo) | `PUSH_PROVIDER=mock` logs pushes (`integrations/channels/push.ts`) |
| M4 | Google Play Console account, app `ge.lokacia.app`, service-account JSON for `eas submit` | `apps/mobile/secrets/play-service-account.json` (gitignored) | — |
| M5 | Firebase project + FCM v1 service-account key uploaded to EAS (Android push) | EAS credentials | mock push channel |
| M6 | Production push: `PUSH_PROVIDER=expo`, `EXPO_ACCESS_TOKEN` (EAS robot token with push security enabled) | API env | `MockPushChannel` |
| M7 | Store listing metadata: Georgian name/subtitle/description/keywords, support + marketing URL, privacy policy URL (lokacia.ge/pages/privacy), age rating questionnaire, category (Business / House & Home) | App Store Connect / Play Console | — |
| M8 | Privacy labels / Data safety form: phone number (account, linked), coarse+precise location (broker capture only, not tracked), photos & audio (user content uploaded by brokers), device push token, crash data if Sentry added; no tracking, no ads | App Store Connect / Play Console | — |
| M9 | Screenshots: 6.9" & 6.5" iPhone, 13" iPad, Android phone + 7"/10" tablet — search, map, listing + SpacePlan, chat, broker capture; Georgian UI, light + dark | design / marketing | web preview (`pnpm --filter @lokacia/mobile web`) for drafts |
| M10 | MapTiler key for the native map style (OSM raster tiles are dev-only per OSM tile policy) | `EXPO_PUBLIC_MAPTILER_KEY` | tinted OSM raster |
| M11 | LiDAR capture on iPhone Pro: native Expo module (ARKit `ARWorldTrackingConfiguration.sceneReconstruction` / RoomPlan → USDZ + room outline) feeding `POST /v1/v2/listings/:id/scans` (Phase 19 pipeline); needs a Swift developer, dev client build and a USDZ → plan converter (#22) | `apps/mobile/modules/lidar` (to create) | UI hint only; no native code built |
| M12 | Production API URL / staging domain for `preview` builds | `eas.json` `EXPO_PUBLIC_API_URL` (`https://api.lokacia.ge`, `https://api.staging.lokacia.ge`) | dev default `http://localhost:4000`; Android emulator `http://10.0.2.2:4000`; physical device → LAN IP |

- Telegram: set `TELEGRAM_WEBHOOK_SECRET` and pass it as `secret_token` to `setWebhook` (the API refuses the webhook in production without it).
