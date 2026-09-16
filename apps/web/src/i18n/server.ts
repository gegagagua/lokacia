import 'server-only';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { createFormat } from './format';
import { languageAlternates, localizePath, OG_LOCALES, LOCALES, PATHNAME_HEADER, toLocale, type Locale } from './locale';

/** Active locale for server components / generateMetadata. */
export async function getAppLocale(): Promise<Locale> {
  return toLocale(await getLocale());
}

/** Unprefixed pathname of the current request (from the proxy), e.g. `/search` for `/en/search`. */
export async function getRequestPathname(): Promise<string> {
  return (await headers()).get(PATHNAME_HEADER) ?? '/';
}

/**
 * Canonical + hreflang alternates + OpenGraph locale for an unprefixed path.
 * Canonical points at the current language version (ka at the root); x-default = ka.
 */
export function localeSeo(path: string, locale: Locale) {
  return {
    alternates: { canonical: localizePath(path, locale), languages: languageAlternates(path) },
    ogLocale: OG_LOCALES[locale],
    ogAlternateLocales: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
  };
}

/** Locale-bound formatters for async server components / generateMetadata. */
export async function getFormat() {
  return createFormat(await getAppLocale());
}
