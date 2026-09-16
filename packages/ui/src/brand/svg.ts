/**
 * Framework-free SVG strings for the lokacia.ge mark (BRAND.md: a location pin set into the corner of a floor plan —
 * two lines and one dot). Used for favicons, manifest icons, OG images, emails and PDFs.
 * Regenerate PNG favicons with `pnpm --filter @lokacia/ui brand:assets -- <app public/app dir>`.
 */
export const BRAND_COLORS = { plaster: '#EDF0EB', basalt: '#17201D', mtatsminda: '#1E4A42', sulfur: '#D8A31A' } as const;

export type MarkSvgOptions = {
  /** tile background; `null` = transparent */
  background?: string | null;
  /** line color */
  stroke?: string;
  dot?: string;
  /** corner radius of the tile in 32-unit viewBox (0 = square, e.g. for Apple which masks itself) */
  radius?: number;
  /** extra inner padding in viewBox units (maskable icons need ≥ 10% safe zone) */
  padding?: number;
};

export function markSvg({ background = BRAND_COLORS.plaster, stroke = BRAND_COLORS.mtatsminda, dot = BRAND_COLORS.sulfur, radius = 6, padding = 0 }: MarkSvgOptions = {}): string {
  const s = (32 - padding * 2) / 32;
  const g = `<g transform="translate(${padding} ${padding}) scale(${s})"><path d="M5 27V9" stroke="${stroke}" stroke-width="2.6" stroke-linecap="square"/><path d="M5 27H23" stroke="${stroke}" stroke-width="2.6" stroke-linecap="square"/><circle cx="21" cy="11" r="4.2" fill="${dot}"/></g>`;
  const bg = background ? `<rect width="32" height="32" rx="${radius}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">${bg}${g}</svg>`;
}

/** Light favicon tile (same as LOGO_SVG). */
export const MARK_SVG_LIGHT = markSvg();
/** Dark tile: basalt background, lightened green lines (dark-theme primary). */
export const MARK_SVG_DARK = markSvg({ background: BRAND_COLORS.basalt, stroke: '#6FB3A2' });
/** Transparent mark in currentColor-less brand green. */
export const MARK_SVG_TRANSPARENT = markSvg({ background: null });
/** Maskable PWA icon: full-bleed square, content inside the 80% safe zone. */
export const MARK_SVG_MASKABLE = markSvg({ radius: 0, padding: 5 });
/** Apple touch icon: square (iOS applies its own mask), slight padding. */
export const MARK_SVG_APPLE = markSvg({ radius: 0, padding: 3 });

/** Horizontal lockup (mark + `lokacia` + `ლოკაცია`) for emails/PDFs. Text uses system fonts; outline it for print. */
export function lockupSvg({ dark = false }: { dark?: boolean } = {}): string {
  const text = dark ? BRAND_COLORS.plaster : BRAND_COLORS.basalt;
  const muted = dark ? '#A9B4AE' : '#56625C';
  const stroke = dark ? '#6FB3A2' : BRAND_COLORS.mtatsminda;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 40" fill="none"><g transform="translate(4 4)"><path d="M5 27V9" stroke="${stroke}" stroke-width="2.6" stroke-linecap="square"/><path d="M5 27H23" stroke="${stroke}" stroke-width="2.6" stroke-linecap="square"/><circle cx="21" cy="11" r="4.2" fill="${BRAND_COLORS.sulfur}"/></g><text x="48" y="28" font-family="'Noto Sans Georgian', system-ui, sans-serif" font-size="22" font-weight="600" fill="${text}">lokacia</text><text x="130" y="28" font-family="'Noto Sans Georgian', system-ui, sans-serif" font-size="15" fill="${muted}">ლოკაცია</text></svg>`;
}
