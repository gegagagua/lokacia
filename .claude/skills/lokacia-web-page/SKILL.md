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

## Brand rules v2 (docs/BRAND.md → "v2 — Modern redesign") — enforced in review
- Modern, airy, readable. Semantic Tailwind colors only: `bg-bg`, `bg-surface`, `bg-surface-2/3`, `text-text`, `text-muted`, `border-border`, `bg-primary text-primary-contrast`, `bg-primary-soft text-primary-soft-text` (tinted tiles/chips), `bg-accent text-accent-contrast` (energetic CTAs, VIP), `text-link`, `text-danger`, `text-success`.
- Depth via `shadow-xs|sm|md|lg` and hover lift (`card-hover` or `transition-all hover:-translate-y-1 hover:shadow-md`); light borders.
- Shape: `rounded-button` (12) buttons/inputs, `rounded-card` (20) cards, `rounded-modal` (28), `rounded-photo` (14) images, `rounded-full` chips/pills/segmented tabs.
- Font FiraGO is global; headings `font-bold` with `tracking-tight` on large sizes; scale `text-display|h1|h2|h3|body|small`; numbers `tabular`. No tiny low-contrast text for key info.
- Marketing/hero bands may use `hero-gradient` (white text), `text-gradient`, `glass`; section header = `eyebrow` pill + big title + muted lead paragraph.
- Image-first cards (4:3 photos with rounded corners, overlay badges); SpacePlan is a secondary signature detail.
- Spacing rhythm: sections `py-16 md:py-24`, grids `gap-6`, card padding `p-5/p-6`.
- Icons: lucide-react `strokeWidth={2}` in tinted icon tiles (`size-11 rounded-2xl bg-primary-soft text-primary-soft-text grid place-items-center`); decorative icons `aria-hidden`.
- Motion 200–300ms ease-out; images `group-hover:scale-[1.04]`; respect reduced motion.
- Accessibility unchanged: labels, focus rings (`focus-visible:shadow-ring`), contrast AA in light & dark, 375px no horizontal scroll.

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
