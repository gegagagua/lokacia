import { localizedText, type AppLocale, type ListingCard } from '@lokacia/contracts';

type LocalizableListing = ListingCard & { description?: string; descriptionEn?: string | null; descriptionRu?: string | null };

/**
 * Listing text per locale (Phase 22): title/description/district name from the `*En`/`*Ru` fields, falling back to ka.
 * Returns a shallow copy so every child component renders the active language without knowing about locales.
 */
export function localizeListing<T extends LocalizableListing>(l: T, locale: AppLocale): T {
  if (locale === 'ka') return l;
  return {
    ...l,
    title: localizedText(l.title, l.titleEn, l.titleRu, locale),
    districtName: l.districtName ? localizedText(l.districtName, l.districtNameEn, l.districtNameRu, locale) : l.districtName,
    ...(typeof l.description === 'string' ? { description: localizedText(l.description, l.descriptionEn, l.descriptionRu, locale) } : {}),
  };
}
