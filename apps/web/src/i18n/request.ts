import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { loadMessages } from './messages';
import { isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from './locale';

/**
 * Locale resolution: `x-lk-locale` request header (set by the proxy from the /en, /ru URL prefix; ka for unprefixed URLs)
 * → `lk_locale` cookie (requests the proxy does not handle) → ka.
 */
export async function resolveRequestLocale(): Promise<Locale> {
  const h = (await headers()).get(LOCALE_HEADER);
  if (isLocale(h)) return h;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : 'ka';
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return { locale, messages: await loadMessages(locale), timeZone: 'Asia/Tbilisi' };
});
