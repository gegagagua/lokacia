import { DEAL_TYPE_LABELS_KA, PASSPORT_FIELDS, formatArea, formatMoney, formatNumber, pricePerM2Minor, relativeDaysKa, type ListingCard, type Passport } from '@lokacia/contracts';
import { t } from './i18n';

/** "3 000 ₾ / თვე" — money rules from packages/contracts (BRAND.md). */
export function priceLabel(l: Pick<ListingCard, 'priceMinor' | 'currency' | 'pricePeriod'>): string {
  const price = formatMoney(l.priceMinor, l.currency);
  switch (l.pricePeriod) {
    case 'month':
      return t('listing.perMonth', { price });
    case 'day':
      return t('listing.perDay', { price });
    case 'hour':
      return t('listing.perHour', { price });
    default:
      return price;
  }
}

export function pricePerM2Label(l: Pick<ListingCard, 'priceMinor' | 'currency' | 'areaM2'>): string | null {
  if (!l.areaM2) return null;
  return t('listing.perM2', { price: formatMoney(pricePerM2Minor(l.priceMinor, l.areaM2), l.currency) });
}

export function cardSubtitle(l: Pick<ListingCard, 'areaM2' | 'districtName' | 'dealType'>): string {
  return [formatArea(l.areaM2), l.districtName, DEAL_TYPE_LABELS_KA[l.dealType]].filter(Boolean).join(' · ');
}

export function confirmedLabel(lastConfirmedAt: string | null, now = new Date()): string | null {
  return lastConfirmedAt ? t('listing.confirmed', { when: relativeDaysKa(lastConfirmedAt, now) }) : null;
}

export type SpecRowData = { key: string; label: string; value: string };

/** Passport → spec rows in PASSPORT_FIELDS order; booleans shown only when known, numbers with units. */
export function passportRows(passport: Passport | null | undefined): SpecRowData[] {
  if (!passport) return [];
  const rows: SpecRowData[] = [];
  for (const f of PASSPORT_FIELDS) {
    const v = passport[f.key];
    if (v === null || v === undefined) continue;
    if (f.kind === 'boolean') rows.push({ key: f.key, label: f.labelKa, value: v ? t('common.yes') : t('common.no') });
    else if (typeof v === 'number') rows.push({ key: f.key, label: f.labelKa, value: `${formatNumber(v, f.kind === 'integer' ? 0 : 1)}${f.unit ? ` ${f.unit}` : ''}` });
  }
  return rows;
}

/** Whole GEL typed by a person → tetri. Accepts "3 000", "3000,50". Returns null when not a positive number. */
export function gelToMinor(input: string): number | null {
  const n = Number(input.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
