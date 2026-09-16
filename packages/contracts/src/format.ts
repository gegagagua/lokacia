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
