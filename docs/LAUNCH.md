# Launch checklist — lokacia.ge v1.0

Runbooks are in [`OPERATIONS.md`](./OPERATIONS.md). Each item has an owner. When an item is done, tick it and add a link to the evidence (CI run, screenshot, drill log).
**Go/no-go meeting at T-1 day:** every item in sections 1–8 is ticked, or has a written waiver signed by the product owner.

## 0. Timeline
| when | milestone |
|---|---|
| T-21 d | Staging is feature-complete, beta data import starts (50 brokers, 300+ spaces) |
| T-14 d | Closed beta with invited agencies; feedback widget on; daily triage |
| T-7 d | Code freeze (fixes only). Load test and restore drill on production hardware |
| T-1 d | Go/no-go. Tag `v1.0.0-rc.N` → production deploy with maintenance page |
| T-0 | DNS/Cloudflare switch, maintenance page off, announcement |
| T+1 d / T+7 d | Post-launch review: errors, performance, funnel, support tickets |

## 1. Infrastructure
- [ ] Production and staging hosts provisioned; Docker, compose and `docker-rollout` installed; origin firewall accepts 80/443 **only from Cloudflare IPs**
- [ ] GitHub environments `staging` and `production` created (production has required reviewers); vars and secrets from OPERATIONS §2 are set
- [ ] `deploy.yml` has run end to end on staging: build → migrate → rolling update → smoke → e2e green
- [ ] A production deploy with a `v*` tag has been rehearsed on staging hardware; the rollback command has been tested once
- [ ] Managed or self-hosted PostgreSQL 16 + PostGIS: `init.sql` roles applied; app role is non-superuser (RLS); PgBouncer in transaction mode
- [ ] Redis runs with AOF and `maxmemory-policy noeviction`; the worker service is running, and API pods have `JOBS_ENABLED=false`
- [ ] R2 buckets exist: `lokacia-media` (versioning on) and `lokacia-pg-backups` (private); imgproxy key and salt set; `STORAGE_DRIVER=s3`
- [ ] DNS: `lokacia.ge`, `www`, `crm`, `admin`, `api` go through Cloudflare (proxied, Full (strict) TLS)
- [ ] Transactional email (SPF, DKIM, DMARC) and the SMS sender ID are approved

## 2. Security
- [ ] Every item in the OPERATIONS §3 review is closed or waived; **S11 (contact rate limits) and S2 (nonce CSP) are closed**
- [ ] Production secrets are unique and stored only in `/srv/lokacia/.env` or the secret manager: `JWT_*`, `IP_HASH_SALT`, `PAYMENTS_WEBHOOK_SECRET`, `MEILI_MASTER_KEY`, `IMGPROXY_*`. The API refuses to boot with `dev_*` values
- [ ] `TURNSTILE_SECRET` and the site key are set; OTP and reveal forms show the challenge
- [ ] `NODE_ENV=production` everywhere, so the dev OTP code is disabled. Test: `POST /v1/auth/otp/verify` with `123456` returns 401
- [ ] Headers checked on securityheaders.com (A or better) for web, crm, admin and api; the domain is submitted to hstspreload.org
- [ ] Admin is reachable only from the office or VPN (`ADMIN_ALLOW_CIDR`); every admin account has a unique phone; impersonation is audited
- [ ] RLS cross-org denial tests are green in CI; a manual pen-test pass covers auth, org isolation, IDOR on listings, offers, documents and presentations, and upload MIME spoofing
- [ ] Cloudflare WAF managed rules on; rate-limiting rule on `/api/v1/auth/*` and `/v1/auth/*`; bot fight mode on for the public web app
- [ ] Dependency audit (`pnpm audit --prod`) has no high or critical findings; images are scanned (GHCR/Trivy)

## 3. Legal and personal data (Georgian Law on Personal Data Protection)
- [ ] Terms of use, privacy policy, cookie notice and the contract template are reviewed by a lawyer and replace the "დემო-ტექსტი" demo texts (HUMAN_TODO #7)
- [ ] Consent is recorded at sign-up (`consent_at`) and for marketing channels separately
- [ ] Phone numbers are hidden until „ნომრის ჩვენება“; every reveal is logged; the rate limit is verified
- [ ] Data export and account delete endpoints work end to end (Phase 14); the retention periods are documented
- [ ] Data processing agreements are signed with the SMS provider, email provider, Sentry (EU region), Cloudflare and the payment provider
- [ ] Personal Data Protection Service registration or notification is filed if required

## 4. SEO
- [ ] `sitemap.xml` (index) and `robots.txt` are reachable; staging sends `X-Robots-Tag: noindex` and blocks crawlers
- [ ] Canonical URLs, `og:image` per listing, and JSON-LD (`RealEstateListing`, `Offer`, `Place`, `BreadcrumbList`, `Organization`) pass the Rich Results Test on 5 sample pages
- [ ] Landing pages for district × business type are generated and linked; there are no thin or duplicate pages (canonical plus `noindex` for empty results)
- [ ] Google Search Console and Bing Webmaster are verified; the sitemap is submitted
- [ ] Redirects for www → apex and trailing slashes; a 404 page in Georgian

## 5. Performance
- [ ] Lighthouse CI (`quality.yml`) is green: mobile performance ≥ 0.9, LCP < 2.5 s, CLS < 0.1 on `/`, `/search` and a listing page
- [ ] k6 runs on production-like hardware with 50 000 listings: search API p95 < 300 ms, listing p95 < 300 ms, error rate < 1 % at the expected peak × 3 VUs
- [ ] Images are served through imgproxy (WebP/AVIF, responsive sizes); fonts are self-hosted with `next/font`
- [ ] Cloudflare caches static assets (`/_next/static/*`, 1 year, immutable); HTML is not cached for logged-in users

## 6. Accessibility and quality
- [ ] Playwright e2e suite is green on staging (`pnpm test:e2e`), with no `test.fixme` left in launch-critical flows
- [ ] axe audit shows no serious or critical violations on every public page (home, search, listing, map, demand, services, projects, pricing, login)
- [ ] Storybook a11y checks pass; dark mode works on every screen; keyboard-only walkthrough of search → listing → phone reveal → viewing booking → publish wizard
- [ ] 360 px mobile has no horizontal scroll; tested on real iOS Safari and Android Chrome
- [ ] `pnpm check:ka` is green; Georgian copy has been proofread by a native editor

## 7. Monitoring and operations
- [ ] Sentry (API, worker, web) receives a test error; release equals `GIT_SHA`; alert rules route to the on-call channel
- [ ] The OTel collector sends traces and metrics; the Grafana dashboard `lokacia-api` has been imported and shows live data; the alerts in OPERATIONS §4 are created
- [ ] External uptime checks for api `/v1/health`, web `/` and crm `/login` page the on-call phone
- [ ] Backups: stanza created, first full backup done, `pgbackrest check` green, **restore drill done on staging with RTO recorded** (OPERATIONS §5)
- [ ] On-call rota and escalation list are published; runbook links are pinned in the ops channel
- [ ] Log retention is set (30 d) and logs contain no PII (cookie and authorization redaction verified)

## 8. Content and beta data
- [ ] Taxonomy (business types with filter configs), Tbilisi district polygons, utility coefficients and the permits checklist per business type are reviewed
- [ ] **50 brokers** onboarded: agencies created, managers invite brokers, every broker has logged in once and completed the profile (photo, bio, phone)
- [ ] **300+ real spaces** imported with the CSV format (`infra/seed/spaces-import.example.csv`) or entered through the wizard; every space has real photos (no stock), a technical passport and a last-confirmed date; each has passed moderation
- [ ] At least 30 owner-verified listings; at least 10 off-plan projects from developers; service providers listed
- [ ] The demo seed is **not** in production (`select count(*) from users where phone like '+9955000000%'` returns 0)
- [ ] Prices, VIP packages and the launch promo date are set in admin settings; payment provider is live (not mock) or payments are hidden behind the promo

## 9. Rollback plan
1. **App regression:** `IMAGE_TAG=<previous tag> docker rollout …` for api, web, crm and admin (about 3 min). Migrations are expand-only, so no database rollback is needed.
2. **Bad data or destructive migration:** maintenance page → PITR restore to just before the deploy (OPERATIONS §5; RTO target < 60 min) → redeploy the previous tag.
3. **Third-party outage:**
   - SMS: switch `SMS_PROVIDER` to the fallback and turn on Google login.
   - Payments: hide paid features with a settings flag.
   - Maps: `MAPTILER_KEY` empty falls back to OSM raster.
4. **DNS or Cloudflare problem:** documented bypass record, TTL 300 s, lowered at T-2 d.
5. Rollback decision owner: tech lead on call. Communicate within 15 min (see §10).

## 10. Communications
- [ ] Status page (for example status.lokacia.ge) linked from the footer and the error pages
- [ ] Launch announcement ready in Georgian: press release, social posts, and an email to beta brokers and agencies
- [ ] Support inbox and phone staffed for the first 2 weeks; FAQ and "how to publish a space" guide live
- [ ] Incident message templates (Georgian): degraded, outage, resolved
- [ ] Feedback widget and privacy-friendly analytics events are verified; the launch KPI dashboard (listings published, reveals, viewings booked, sign-ups) is ready
