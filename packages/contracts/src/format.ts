/** Georgian formatting rules from BRAND.md: `3 000 ₾`, `16 სექტემბერი, 2026`. */

export const MONTHS_KA = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
] as const;

export const WEEKDAYS_KA = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'] as const;

const CURRENCY_SIGN: Record<string, string> = { GEL: '₾', USD: '$', EUR: '€' };

/** Groups thousands with a regular space. */
export function formatNumber(value: number, fractionDigits = 0): string {
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [int = '0', frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = value < 0 ? '−' : '';
  return frac && Number(frac) !== 0 ? `${sign}${grouped},${frac}` : `${sign}${grouped}`;
}

/** Money in minor units (tetri) → "3 000 ₾". */
export function formatMoney(minor: number, currency = 'GEL'): string {
  const major = minor / 100;
  const digits = Number.isInteger(major) ? 0 : 2;
  const sign = CURRENCY_SIGN[currency] ?? currency;
  return currency === 'GEL' ? `${formatNumber(major, digits)} ${sign}` : `${sign}${formatNumber(major, digits)}`;
}

export function formatArea(m2: number): string {
  return `${formatNumber(m2, Number.isInteger(m2) ? 0 : 1)} მ²`;
}

export function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

/** "16 სექტემბერი, 2026" */
export function formatDateKa(input: Date | string): string {
  const d = toDate(input);
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatDateTimeKa(input: Date | string): string {
  const d = toDate(input);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateKa(d)}, ${hh}:${mm}`;
}

/** "დადასტურდა 3 დღის წინ" helper: returns the relative part only ("3 დღის წინ", "დღეს"). */
export function relativeDaysKa(input: Date | string, now: Date = new Date()): string {
  const d = toDate(input);
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days <= 0) return 'დღეს';
  if (days === 1) return 'გუშინ';
  if (days < 30) return `${days} დღის წინ`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} თვის წინ`;
  return `${Math.floor(months / 12)} წლის წინ`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function pricePerM2Minor(priceMinor: number, areaM2: number): number {
  return areaM2 > 0 ? Math.round(priceMinor / areaM2) : 0;
}

/** Latin transliteration for slugs (national system). */
const TRANSLIT: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o',
  პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts',
  ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Locale-aware helpers (Phase 22). The `*Ka` helpers above stay the Georgian defaults.
// ka: `3 000 ₾`, `16 სექტემბერი, 2026` · en: `3,000 ₾`, `September 16, 2026` · ru: `3 000 ₾`, `16 сентября 2026`
// ---------------------------------------------------------------------------

export const APP_LOCALES = ['ka', 'en', 'ru'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'ka';

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

/** Normalizes anything (cookie, header, next-intl locale) to a supported locale, falling back to ka. */
export function toAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
/** Genitive month names used in Russian dates ("16 сентября 2026"). */
export const MONTHS_RU_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] as const;

const SEPARATORS: Record<AppLocale, { group: string; decimal: string }> = {
  ka: { group: ' ', decimal: ',' },
  en: { group: ',', decimal: '.' },
  ru: { group: ' ', decimal: ',' },
};

/** Thousands grouping per locale: ka/ru `3 000,5`, en `3,000.5`. */
export function formatNumberFor(value: number, locale: AppLocale, fractionDigits = 0): string {
  const { group, decimal } = SEPARATORS[locale] ?? SEPARATORS.ka;
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [int = '0', frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = value < 0 ? '−' : '';
  return frac && Number(frac) !== 0 ? `${sign}${grouped}${decimal}${frac}` : `${sign}${grouped}`;
}

/** Money in minor units. GEL keeps `₾` after the amount in every locale; USD/EUR put the sign first. */
export function formatMoneyFor(minor: number, locale: AppLocale, currency = 'GEL'): string {
  const major = minor / 100;
  const digits = Number.isInteger(major) ? 0 : 2;
  const sign = CURRENCY_SIGN[currency] ?? currency;
  const amount = formatNumberFor(major, locale, digits);
  return currency === 'GEL' ? `${amount} ${sign}` : `${sign}${amount}`;
}

const AREA_UNIT: Record<AppLocale, string> = { ka: 'მ²', en: 'm²', ru: 'м²' };

export function formatAreaFor(m2: number, locale: AppLocale): string {
  return `${formatNumberFor(m2, locale, Number.isInteger(m2) ? 0 : 1)} ${AREA_UNIT[locale] ?? AREA_UNIT.ka}`;
}

/** Unit suffix for "per m²" style labels. */
export function areaUnit(locale: AppLocale): string {
  return AREA_UNIT[locale] ?? AREA_UNIT.ka;
}

export function formatDateFor(input: Date | string, locale: AppLocale): string {
  const d = toDate(input);
  if (locale === 'en') return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (locale === 'ru') return `${d.getDate()} ${MONTHS_RU_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
  return formatDateKa(d);
}

export function formatDateTimeFor(input: Date | string, locale: AppLocale): string {
  const d = toDate(input);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateFor(d, locale)}, ${hh}:${mm}`;
}

/** Month + year only ("September 2026", "сентябрь 2026", "სექტემბერი 2026"). */
export function formatMonthYearFor(input: Date | string, locale: AppLocale): string {
  const d = toDate(input);
  const m = d.getMonth();
  if (locale === 'en') return `${MONTHS_EN[m]} ${d.getFullYear()}`;
  if (locale === 'ru') return `${MONTHS_RU_NOMINATIVE[m]} ${d.getFullYear()}`;
  return `${MONTHS_KA[m]} ${d.getFullYear()}`;
}

const MONTHS_RU_NOMINATIVE = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] as const;

/** Russian plural form picker: 1 день, 2 дня, 5 дней. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Relative age: "3 days ago" / "3 дня назад" / "3 დღის წინ"; today/yesterday wording per locale. */
export function relativeDaysFor(input: Date | string, locale: AppLocale, now: Date = new Date()): string {
  if (locale === 'ka') return relativeDaysKa(input, now);
  const d = toDate(input);
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  if (locale === 'en') {
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
    if (days < 30) return unit(days, 'day');
    if (months < 12) return unit(months, 'month');
    return unit(years, 'year');
  }
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 30) return `${days} ${ruPlural(days, 'день', 'дня', 'дней')} назад`;
  if (months < 12) return `${months} ${ruPlural(months, 'месяц', 'месяца', 'месяцев')} назад`;
  return `${years} ${ruPlural(years, 'год', 'года', 'лет')} назад`;
}

export type PricePeriod = 'month' | 'total' | 'day' | 'hour';
const PERIOD_UNITS: Record<AppLocale, Record<PricePeriod, string>> = {
  ka: { month: 'თვე', day: 'დღე', hour: 'სთ', total: '' },
  en: { month: 'mo', day: 'day', hour: 'hr', total: '' },
  ru: { month: 'мес.', day: 'сутки', hour: 'ч', total: '' },
};

/** Price period suffix including the separator: " / თვე", " / mo", "" for total. */
export function pricePeriodSuffix(period: PricePeriod | undefined, locale: AppLocale): string {
  const unit = period ? (PERIOD_UNITS[locale] ?? PERIOD_UNITS.ka)[period] : '';
  return unit ? ` / ${unit}` : '';
}

/** Picks `nameKa` / `nameEn` / `nameRu` for the locale, falling back to Georgian when the translation is empty. */
export function localizedName(item: { nameKa: string; nameEn?: string | null; nameRu?: string | null }, locale: AppLocale): string {
  if (locale === 'en' && item.nameEn) return item.nameEn;
  if (locale === 'ru' && item.nameRu) return item.nameRu;
  return item.nameKa;
}

/** Picks a per-locale text column (`title`/`titleEn`/`titleRu`), falling back to the Georgian value. */
export function localizedText(ka: string, en: string | null | undefined, ru: string | null | undefined, locale: AppLocale): string {
  if (locale === 'en' && en && en.trim()) return en;
  if (locale === 'ru' && ru && ru.trim()) return ru;
  return ka;
}
