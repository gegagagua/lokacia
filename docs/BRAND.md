# Brand & design system

Concept: **cadastral drawing**. The product must look like an architecture bureau's drawing — precise, calm, expensive — not a classifieds board.
Principles: precision (every number — m², kW, ceiling height — visible at first glance), calm (lots of space, one accent per screen), trust (verified owner, last-confirmed date, real photos on every listing).

## Logo
- Mark: a location pin set into the corner of a floor plan. Two lines and one dot. Build as SVG in `packages/ui/src/brand/Logo.tsx` (mark, wordmark, lockup).
- Wordmark: lowercase Latin `lokacia` with Mkhedruli `ლოკაცია` alongside.
- Min size 20 px on screen. Clear space = half the mark height on every side.

## Color tokens (`packages/ui/tokens.css`, exposed to Tailwind)
| token | name | hex | use |
|---|---|---|---|
| `--c-plaster` | Sololaki plaster | #EDF0EB | main background |
| `--c-basalt` | Basalt | #17201D | main text; dark-mode background |
| `--c-mtatsminda` | Mtatsminda green | #1E4A42 | brand, primary buttons |
| `--c-sulfur` | Sulfur yellow | #D8A31A | accent: map pins, active status, VIP (small elements only) |
| `--c-blueprint` | Blueprint blue | #2F5FB8 | links, technical lines, map routes |
| `--c-stone` | Stone grey | #8A968F | secondary text, borders |
| `--c-brick` | Brick | #B4492F | errors, warnings |

Proportion: 70% plaster, 20% basalt, 8% green, 2% yellow. Define light and dark themes (dark: basalt background, plaster text, lightened green/blue to keep 4.5:1 contrast). Verify contrast with an automated test.

## Typography
- Noto Sans Georgian (variable, 300–700) for UI and body; `wdth 75` for headings and large numbers (compact, architectural).
- `font-variant-numeric: tabular-nums` in tables and all numeric specs.
- Scale (size / line-height px): display 56/60, h1 40/48, h2 28/36, h3 20/28, body 16/26, small 13/20. Georgian body line-height 1.6.
- Self-host fonts via `next/font`.

## Layout & components
- 12-column grid, 1200 px max width, 8 px base spacing.
- Radius: buttons 6, cards 12, modals 20, listing photos 4.
- Shadows: almost none — depth comes from borders and background.
- Icons: Lucide, 1.5 px stroke, square caps.
- Map: custom MapLibre style — plaster city, green parks, blue rivers, yellow pins.
- Motion: one signature moment — pins drop onto the map after a search. Everything else 150–200 ms, only on user action. Respect `prefers-reduced-motion`.
- Photography: architectural, natural light, symmetric. No stock photos (use neutral placeholders in seeds).
- Signature component: `SpacePlan` — a listing card header drawing the space outline with dimension lines (width × depth, m², ceiling, kW), like a floor plan.

## Required `packages/ui` components (with Storybook stories)
Button, IconButton, Input, Select, Combobox, Checkbox, Radio, Switch, Slider (range), Tabs, Dialog, Drawer, Popover, Tooltip, Toast, Badge (status/VIP/verified), Avatar, Card, ListingCard, SpacePlan, SpecRow, Table (sortable), EmptyState, Skeleton, Pagination, Stepper, FileUpload (drag & drop, reorder), MapView, PriceTag, Kanban, Calendar, ChatThread, Logo.

## Copy rules (Georgian)
Plain, concrete, short. Buttons state the action: „ფართის გამოქვეყნება“, „ჩვენების ჯავშნა“, „ნომრის ჩვენება“, „ძებნის შენახვა“. Dates: `16 სექტემბერი, 2026`. Numbers: space as thousands separator, `₾` after the amount (`3 000 ₾`).

---

## v2 — Modern redesign (2026-09-17, owner request: "maximally modern, readable, not dry")
Supersedes the v1 rules above where they conflict (no shadows / no gradients / condensed headings / drafting grid). Palette and logo stay.

- **Feel:** premium proptech — airy, bright, confident. White surfaces on a soft neutral page (`bg-bg` #F5F7F4), deep Mtatsminda green as the primary, sulfur yellow as the energetic accent (CTAs like "publish", VIP, highlights), blueprint blue for links.
- **Typography:** FiraGO (self-hosted, Georgian + Latin + Cyrillic). Headings bold 700, normal width, slight negative tracking on large sizes; body 16/1.65. Scale: display 60/68, h1 44/52, h2 32/40, h3 21/30, small 14/21. Numbers `tabular`. Never use tiny 12px body copy for important info.
- **Depth:** soft layered shadows `shadow-xs|sm|md|lg` (tokens `--elev-*`), hover lift on interactive cards (`card-hover` or `hover:-translate-y-1 hover:shadow-md`). Borders are light (`border-border`).
- **Shape:** buttons 12px, inputs 12px (h-12), cards 20px, modals 28px, photos 14px, chips/badges fully rounded pills.
- **Gradients allowed** for hero and feature bands: `hero-gradient` (deep green with warm glow), `text-gradient` for a highlighted word, subtle image overlays. `glass` utility for sticky headers/overlays.
- **Imagery first:** listing cards and pages lead with large photos (illustrated placeholders in seed). The SpacePlan drawing stays as a signature detail (mini inset / technical section), not the hero of every card.
- **Layout:** `container-page` 1240px, generous section rhythm (`py-16 md:py-24` for marketing sections, `gap-6/8` grids), eyebrow pill above section titles (`eyebrow`), big section titles.
- **Components:** segmented pill tabs, pill filters/chips, icon tiles with soft tinted backgrounds (`bg-primary-soft text-primary-soft-text`), stat cards with large numbers, empty states with tinted icon tile, skeletons rounded.
- **Motion:** 200–300ms ease-out on hover/press (lift, scale 1.04 on images), pin-drop remains the map signature. Respect reduced motion.
- **Dark mode:** near-black green surfaces, mint primary (#4CC3A2), same component shapes.
- **Utilities:** `card`, `card-hover`, `glass`, `hero-gradient`, `text-gradient`, `eyebrow`; `drawing-grid` now renders a soft dotted tint (legacy name).
