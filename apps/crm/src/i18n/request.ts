import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { loadMessages, LOCALES, type Locale } from './messages';

/** ka is primary; en/ru exist as placeholders (fall back to ka strings until translated). */
export default getRequestConfig(async () => {
  const c = (await cookies()).get('lk_locale')?.value as Locale | undefined;
  const locale: Locale = c && LOCALES.includes(c) ? c : 'ka';
  return { locale, messages: await loadMessages(locale), timeZone: 'Asia/Tbilisi' };
});
