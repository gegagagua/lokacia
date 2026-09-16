# Product specification

## Overview
lokacia.ge — Georgia's first portal only for commercial space. A space is shown through a business lens: *will my business work here?*
Mission: make finding the right location — the hardest step in opening a business — fast, transparent and data-driven.

Segments:
| segment | who | main pain |
|---|---|---|
| Tenant business | cafe, salon, pharmacy, office, chain | no business-specific filters, stale listings |
| Owner | commercial space owner | space sits empty, right price unknown |
| Broker | individual broker, agency | clients live in Excel and phones |
| Developer | construction company | pre-leasing ground-floor units |

Differentiators vs ss.ge / myhome.ge: business-type filters, technical passport, location analytics, listing liveness control, broker CRM — in one system.

Roles: `guest`, `user` (tenant/owner), `broker`, `agency_manager`, `agency_assistant`, `developer`, `moderator`, `admin`.
Deal types: `rent`, `sale`, `transfer` (business handover), `short_term`.
Business types (seed, extendable): cafe/restaurant, bar, bakery, retail, pharmacy, beauty salon, clinic, office, coworking, warehouse, production, showroom, car service, fitness, education, pop-up.

---

## v1.0 — Portal (24 features)
Each feature lists acceptance criteria (AC). A feature is done only when its AC are covered by tests.

1. **Search by business type** — choosing a business type swaps the filter set (e.g. cafe → hood, gas, ceiling height, shop window; warehouse → truck access, gate width, 24/7). AC: filter config is data-driven (`business_type_filters` table/JSON); URL reflects all filters; results update < 300 ms p95 from Meilisearch.
2. **Technical passport** — power (kW), three-phase, ceiling height, facade width, hood, gas, wet points, gate width, truck access, 24/7 access, parking, floor plan with dimensions. AC: required fields vary by business type; shown as `SpecRow`s and in `SpacePlan`.
3. **Location analytics** — competitors within 500 m (same business type), transport, schools, business centers, price/m² vs district average. AC: `GET /v1/geo/insights?lat&lng&businessType` returns counts + nearest items + price delta; POIs imported from OpenStreetMap (script in `apps/api/scripts/import-osm`).
4. **Listing liveness control** — every 10–14 days the owner confirms the space is still free (SMS/Telegram/email link, one tap). No answer in 72 h → listing hidden (`stale`). AC: BullMQ scheduled job; `last_confirmed_at` shown on the card ("დადასტურდა 3 დღის წინ").
5. **Owner vs broker transparency** — clear badge, broker commission shown, filter "only from owners", owner verification by uploading a public registry extract (moderator approves). AC: `verified_owner` badge only after approval.
6. **Demand board** — businesses post what they're looking for; owners and brokers contact them. AC: requests expire (default 30 days); matching listings suggested to the requester.
7. **New-space alerts** — saved search → instant Telegram, Viber or email. AC: on listing publish, matching saved searches are found (Meilisearch filter replay) and notified within 1 min; unsubscribe link.
8. **Off-plan spaces** — developers publish units in buildings under construction; businesses pre-book. AC: listing has `completion_date`, building/project entity, pre-booking request flow.
9. **Real monthly cost calculator** — rent + utilities + service fee + deposit + estimated fit-out. AC: per-listing widget; utilities estimate from area × business-type coefficient (config table).
10. **Space history** — which businesses were here before and for how long; frequent closures flagged. AC: `listing_history` editable by owner/moderator; warning if ≥3 closures in 3 years.
11. **Business transfer** — ready business with equipment; space price and equipment price separate. AC: deal_type `transfer`, equipment list with prices.
12. **Permits checklist** — by business type: which permits/registrations are needed and where to apply. AC: content managed in admin (markdown), shown on listing and business-type pages.
13. **Natural-language search (AI)** — "50 m² კაფესთვის ვაკეში, 3000 ლარამდე" → filters filled automatically. AC: `POST /v1/search/parse` returns a validated Zod filter object; user sees chips and can edit; fallback to keyword search on failure; results cached.
14. **Favorites & comparison table** — saved spaces in one table, shareable link for a team. AC: compare up to 6; share link read-only.
15. **Video viewing & visit booking** — 360° photos, online viewing link, visit slot in calendar. AC: owner defines availability; booking creates `viewing`; ICS attachment.
16. **Offer & negotiation** — price, term, free fit-out months; everything recorded. AC: offer thread with counter-offers (`parent_offer_id`), statuses, notifications.
17. **Contract template** — indexation, early termination, who pays for fit-out; paid lawyer consultation upsell. AC: generates PDF from accepted offer; placeholder legal text flagged in HUMAN_TODO.
18. **Price recommendation** — "your price is 20% above the district average". AC: shown on listing create/edit and in owner stats.
19. **Listing statistics** — views, calls (phone reveals), saves, plus advice why it isn't renting. AC: daily aggregates table; rule-based advice (price, photos count, passport completeness, liveness).
20. **Tenant profile** — activity, experience, desired term; owner sees who they rent to. AC: attached to offers and viewing requests.
21. **Partial & short-term rent** — corner in a shop, kitchen by the hour, one-month pop-up. AC: `short_term` with hourly/daily/monthly pricing and availability calendar.
22. **Broker CRM** — see CRM section.
23. **Price & vacancy map** — by district. Paid reports for banks, chains, developers. AC: district choropleth (avg price/m², vacancy count); report purchase via billing.
24. **Services marketplace** — fit-out, design, signage, equipment; commission per order. AC: provider profiles, request-a-quote flow, order status, commission recorded.

## v1.0 — Broker CRM (24 features, `apps/crm`)
### Clients & deals
1. **Contact base** — clients, owners, partners; automatic duplicate merge (phone normalization E.164 + trigram name match, manual confirm).
2. **Automatic requirement matching** — each client requirement compared to every new listing; notify on match.
3. **Deal kanban** — lead → viewing → offer → contract → closed (won/lost), drag and drop; stages configurable per org.
4. **Viewing calendar** — Google Calendar sync; route order optimization for a day's viewings.
5. **Tasks & reminders** — due dates, push and Telegram reminders.
6. **Unified inbox** — portal chat, WhatsApp, Viber, Telegram in one window (adapters; mock in dev).
7. **Click-to-call** — `tel:` + call log + post-call note prompt.
8. **Client portal** — client sees the curated spaces, marks like / dislike (public tokenized link).
### Listings & marketing
9. **One-click publish** — to lokacia.ge and via XML feed to other portals (`GET /v1/feeds/:orgId.xml`).
10. **Branded presentation** — selected spaces as link or PDF with broker logo; broker sees when the client opened it.
11. **AI descriptions & photo enhancement** — listing text in ka/en/ru in one click; light/perspective correction (imgproxy/sharp pipeline).
12. **Broker public profile** — mini-site with listings, offers, reviews (`/broker/:slug`).
13. **Automatic owner report** — weekly: views, calls, viewings.
14. **Liveness automation** — system asks owners for status automatically.
15. **Competitor monitoring** — same space on other portals, price changes (adapter + manual URL tracking; scraping must respect robots/ToS — list in HUMAN_TODO).
16. **Automated follow-up sequences** — SMS/email templates: after viewing, +3 days, +7 days.
### Team, finance, analytics
17. **Team & permissions** — roles manager/agent/assistant; automatic lead distribution (round-robin / by district).
18. **Commission calculator** — deal finance, agent share, expected revenue.
19. **Lead sources & ROI** — where the client came from and acquisition cost.
20. **KPI dashboard** — deals, conversion, average cycle, agent ranking.
21. **Documents & e-signature** — exclusivity agreements, acts, versions, e-sign adapter.
22. **Co-brokering** — share a listing with other brokers with pre-agreed commission split.
23. **Mobile mode (PWA)** — add a space on-site: photos, GPS, voice note; offline queue.
24. **Import & audit** — Excel/Google Sheets import with column mapping, full action log, data export.

## v2.0 (10 features)
v2.0 turns the portal into a location-analytics platform and payment system.
1. **Foot traffic** — partner data (mobile operators, sensors): hourly flow. Adapter + mock dataset.
2. **Location score (AI)** — 0–100 per business type from traffic, competition, price, transport. Explainable breakdown shown to user.
3. **Digital contract & deposit escrow** — online signing; deposit held on a neutral account via the PSP. State machine: pending → funded → released/refunded/disputed.
4. **Online rent payments** — monthly payments, invoices, late notices, accounting export (CSV/XLSX).
5. **3D tour & floor-plan generator** — LiDAR scan from phone (mobile app) → automatic plan; web viewer for uploaded scans/tours.
6. **Analytics API & market reports** — subscription API keys for banks, investors, chains; usage metering.
7. **Mobile apps** — Expo React Native, iOS & Android, push, map search, shares `packages/contracts`.
8. **Regions & languages** — Batumi, Kutaisi, Rustavi; English and Russian versions (hreflang, localized slugs).
9. **Property management module** — maintenance requests, utilities, tenant communication.
10. **Finance marketplace** — fit-out loans, leasing, insurance with bank partners; commission per approved application.

## Monetization (implemented in billing)
| source | model | indicative price |
|---|---|---|
| VIP listing | 7 or 30 days on top | 15–40 ₾ |
| Owner package | 5 listings + stats | 49 ₾ / month |
| Broker CRM | per-agent subscription | 59–99 ₾ / month |
| Agency package | team, automation, feeds | from 290 ₾ / month |
| Developer package | off-plan units, landing page | custom |
| Analytics report | detailed location report | 99–299 ₾ |
| Services marketplace | commission per order | 8–12% |
| Business transfer | commission or paid listing | 1–2% or 99 ₾ |
Prices are configurable in admin (not hard-coded). First 3 months free: implement a global `launch_promo_until` setting.
