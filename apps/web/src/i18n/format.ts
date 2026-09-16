import {
  DEAL_TYPE_LABELS, LISTING_STATUS_LABELS, SEARCH_SORT_LABELS, areaUnit, formatAreaFor, formatDateFor, formatDateTimeFor, formatMoneyFor, formatMonthYearFor,
  formatNumberFor, localizeUnit, localizedName, localizedText, passportLabel, pricePeriodSuffix, relativeDaysFor,
  type AppLocale, type DealType, type ListingStatus, type PassportKey, type PricePeriod, type SearchSort,
} from '@lokacia/contracts';
import { cityName } from '@/lib/site';

/**
 * Locale-bound formatters (Phase 22) — one object instead of the `*Ka` helpers:
 * `const f = useFormat()` (client or sync server component) / `const f = await getFormat()` (async server component).
 */
export function createFormat(locale: AppLocale) {
  return {
    locale,
    money: (minor: number, currency = 'GEL') => formatMoneyFor(minor, locale, currency),
    number: (value: number, fractionDigits = 0) => formatNumberFor(value, locale, fractionDigits),
    area: (m2: number) => formatAreaFor(m2, locale),
    areaUnit: areaUnit(locale),
    unit: (kaUnit: string | undefined) => localizeUnit(kaUnit, locale),
    date: (d: Date | string) => formatDateFor(d, locale),
    dateTime: (d: Date | string) => formatDateTimeFor(d, locale),
    monthYear: (d: Date | string) => formatMonthYearFor(d, locale),
    relativeDays: (d: Date | string) => relativeDaysFor(d, locale),
    period: (p: PricePeriod | undefined) => pricePeriodSuffix(p, locale),
    dealType: (t: DealType) => DEAL_TYPE_LABELS[locale][t],
    listingStatus: (s: ListingStatus) => LISTING_STATUS_LABELS[locale][s],
    sort: (s: SearchSort) => SEARCH_SORT_LABELS[locale][s],
    city: (slug: string) => cityName(slug, locale),
    passport: (key: PassportKey) => passportLabel(key, locale),
    name: (item: { nameKa: string; nameEn?: string | null; nameRu?: string | null }) => localizedName(item, locale),
    text: (ka: string, en?: string | null, ru?: string | null) => localizedText(ka, en, ru, locale),
  };
}

export type Format = ReturnType<typeof createFormat>;
