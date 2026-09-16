export const SITE_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
export const SITE_NAME = 'lokacia.ge';
export const SITE_DESCRIPTION = 'კომერციული ფართები საქართველოში — ოფისები, მაღაზიები, საწყობები, კაფეს ფართები. ფილტრები ბიზნესის ტიპის მიხედვით, ტექნიკური პასპორტი და ლოკაციის ანალიტიკა.';
export const CITY_NAMES_KA: Record<string, string> = { tbilisi: 'თბილისი', batumi: 'ბათუმი', kutaisi: 'ქუთაისი', rustavi: 'რუსთავი' };
export const absUrl = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);

/** City names per locale (Phase 22). */
export const CITY_NAMES: Record<'ka' | 'en' | 'ru', Record<string, string>> = {
  ka: CITY_NAMES_KA,
  en: { tbilisi: 'Tbilisi', batumi: 'Batumi', kutaisi: 'Kutaisi', rustavi: 'Rustavi' },
  ru: { tbilisi: 'Тбилиси', batumi: 'Батуми', kutaisi: 'Кутаиси', rustavi: 'Рустави' },
};
export const cityName = (slug: string, locale: 'ka' | 'en' | 'ru' | string = 'ka') => (CITY_NAMES[locale as 'ka'] ?? CITY_NAMES_KA)[slug] ?? CITY_NAMES_KA[slug] ?? slug;
