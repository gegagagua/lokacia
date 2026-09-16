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
| 16 | App Store / Play Store accounts, store metadata (v2 mobile) | — | not built in this web iteration |
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
