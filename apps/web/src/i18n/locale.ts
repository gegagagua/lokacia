/**
 * Public locale routing (Phase 22) — safe for proxy, server and client code (no Node/React imports).
 * ka is canonical at the root (no prefix); en and ru live under /en/... and /ru/... and are rewritten by
 * `src/proxy.ts` to the same app routes with the `x-lk-locale` request header.
 */
export const LOCALES = ['ka', 'en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ka';
export const PREFIXED_LOCALES = ['en', 'ru'] as const satisfies readonly Locale[];

export const LOCALE_COOKIE = 'lk_locale';
export const LOCALE_HEADER = 'x-lk-locale';
/** Unprefixed pathname of the current request (set by the proxy; used for hreflang in the root layout). */
export const PATHNAME_HEADER = 'x-lk-pathname';

export const OG_LOCALES: Record<Locale, string> = { ka: 'ka_GE', en: 'en_US', ru: 'ru_RU' };
/** BCP 47 tags for `<html lang>` / hreflang. */
export const HTML_LANG: Record<Locale, string> = { ka: 'ka', en: 'en', ru: 'ru' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** "/en/search" → { locale: 'en', path: '/search' }; "/search" → { locale: null, path: '/search' }. `/ka/...` is recognised too. */
export function splitLocalePath(pathname: string): { locale: Locale | null; path: string } {
  const m = /^\/(ka|en|ru)(?=\/|$)(.*)$/.exec(pathname);
  if (!m) return { locale: null, path: pathname || '/' };
  return { locale: m[1] as Locale, path: m[2] || '/' };
}

/** Paths that are never locale-prefixed (API proxy, Next internals, files, sitemaps). */
function isUnlocalizable(path: string): boolean {
  return /^\/(api|_next)(\/|$)/.test(path) || /^\/(sitemap|robots\.txt|manifest)/.test(path);
}

/**
 * Prefixes an internal href for the locale: `localizePath('/search?q=1', 'en')` → `/en/search?q=1`.
 * External URLs, hash/relative links, API paths and already-prefixed paths are returned as-is (prefix replaced when it differs).
 */
export function localizePath(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);
  const { path } = splitLocalePath(pathname);
  if (isUnlocalizable(path)) return href;
  if (locale === DEFAULT_LOCALE) return `${path}${rest}`;
  return `/${locale}${path === '/' ? '' : path}${rest}`;
}

/** hreflang map for an unprefixed path: ka at the root, en/ru prefixed, x-default = ka. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ka: localizePath(path, 'ka'),
    en: localizePath(path, 'en'),
    ru: localizePath(path, 'ru'),
    'x-default': localizePath(path, 'ka'),
  };
}

/** URL of the current page in another language, keeping query and hash (language switcher). */
export function switchLocaleHref(loc: { pathname: string; search: string; hash: string }, target: Locale): string {
  const { path } = splitLocalePath(loc.pathname);
  return localizePath(`${path}${loc.search}${loc.hash}`, target);
}
