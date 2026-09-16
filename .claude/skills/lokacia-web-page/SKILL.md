---
name: lokacia-web-page
description: How to build pages and UI in the lokacia.ge Next.js apps (apps/web, apps/crm, apps/admin) using @lokacia/ui, next-intl messages, server/client API helpers, SEO metadata and the cadastral-drawing brand rules. Use for any frontend work in this repo.
---

# Frontend pages (Next.js 16 App Router)

## Data
- Server components: `import { api, apiOrNull } from '@/lib/api-server'` → forwards cookies. Public cacheable data: `api(path, { auth: false, revalidate: 300 })`.
- Session: `getSession()` from `@/lib/session` (null when logged out). Protect pages with `redirect('/login?next=...')`.
- Client components: `apiFetch(path, { method, body, orgId })` from `@/lib/api-client` (auto-refreshes session on 401); SWR with `fetcher`. Errors are `ClientApiError` with `.problem` (RFC 9457, Georgian `title`, `errors[]` per field).
- Uploads: `uploadFile(file, { kind, listingId, onProgress })` returns media id.
- Browser always calls same-origin `/api/v1/...` (rewritten to the API). Never hardcode `localhost:4000` in client code.
- Taxonomy: `getBusinessTypes()`, `getDistricts(city)` from `@/lib/taxonomy`.

## UI kit — `@lokacia/ui`
Button (variants primary/secondary/ghost/danger/link/accent, `asChild` for links), IconButton(label), Field+Input/Textarea/Select/Checkbox/RadioGroup/Switch/Slider, Combobox, Dialog, Drawer, Popover, Tooltip, Tabs, `useToast()`, Badge/VipBadge/VerifiedBadge, Avatar, Card, SectionTitle, EmptyState, Skeleton, SpecRow, Stat, Stepper, Table (sortable), Pagination, SpacePlan, PriceTag, ListingCard, FileUpload, Calendar, ChatThread, Kanban, Logo. Map: `import { MapView } from '@lokacia/ui/map'` (client only; wrap with `next/dynamic` `ssr:false` when used in server pages).
Formatting from `@lokacia/contracts`: `formatMoney(minor)` → `3 000 ₾`, `formatArea`, `formatDateKa` → `16 სექტემბერი, 2026`, `relativeDaysKa`, `DEAL_TYPE_LABELS_KA`, `PASSPORT_FIELDS`.

## Brand rules (docs/BRAND.md) — enforced in review
- Tailwind semantic colors only: `bg-bg`, `bg-surface`, `bg-surface-2`, `text-text`, `text-muted`, `border-border`, `border-border-strong`, `bg-primary text-primary-contrast`, `text-link`, `text-danger`, `bg-accent` (sulfur: tiny elements only — pins, VIP, active).
- No shadows, no gradients, no stock photos. Depth = borders + background. Radius: buttons `rounded-button`, cards `rounded-card`, modals `rounded-modal`, photos `rounded-photo`.
- Type scale utilities: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-small`; headings/large numbers get `compact`; numbers get `tabular`.
- Layout: `container-page` (1200px, 16px gutters), 8px spacing rhythm, mobile first, no horizontal scroll at 360px.
- Icons: lucide-react with `strokeWidth={1.5}`, decorative icons `aria-hidden`.
- Motion 150–200ms on user action only; pin-drop is the one signature animation.
- Accessibility: every control labelled, visible focus (global), `aria-live` for async results, dark mode works automatically via tokens.

## i18n
- All UI strings in `messages/ka/<namespace>.json` (one namespace file per feature area — create your own file; do not edit other teams' files). Mirror keys with empty strings in `messages/en/` and `messages/ru/`.
- Server: `const t = await getTranslations('namespace')`; client: `useTranslations('namespace')`.
- Copy rules: skill `lokacia-georgian-copy`. Run `pnpm check:ka`.

## SEO (public pages)
- Export `generateMetadata` with `title`, `description`, `alternates.canonical`, `openGraph` (title, description, url, images), `twitter`.
- JSON-LD via `<script type="application/ld+json">` (schema.org `RealEstateListing`/`Offer`/`Place`, `BreadcrumbList`, `Organization`).
- Private pages (`/account/*`, `/login`, token links): `robots: { index: false }`.

## Verify
- `npx tsc --noEmit` in the app; open the page (skill `lokacia-run-and-verify`), check light + dark + 375px width.
