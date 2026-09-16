import { formatDateFor, MONTHS_KA, WEEKDAYS_KA, type AppLocale } from '@lokacia/contracts';

/** Asia/Tbilisi wall-clock helpers (server and browser render the same text). */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const headingFmt = {
  en: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  ru: new Intl.DateTimeFormat('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' }),
} as const;

export const tbDayKey = (d: Date | string) => dayFmt.format(new Date(d));
export const tbTime = (d: Date | string) => timeFmt.format(new Date(d));
/** "2026-09-16" → local Date at midnight (for Calendar, which uses local getters). */
export const keyToDate = (k: string) => {
  const [y, m, dd] = k.split('-').map(Number);
  return new Date(y!, m! - 1, dd!);
};
const pad = (n: number) => String(n).padStart(2, '0');
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const tbDateKa = (d: Date | string, locale: AppLocale = 'ka') => formatDateFor(keyToDate(tbDayKey(d)), locale);
export const tbDateTimeKa = (d: Date | string, locale: AppLocale = 'ka') => `${tbDateKa(d, locale)}, ${tbTime(d)}`;
/** Day heading: "ოთხშაბათი, 16 სექტემბერი" / "Wednesday, September 16" / "среда, 16 сентября". */
export const dayHeadingKa = (key: string, locale: AppLocale = 'ka') => {
  const d = keyToDate(key);
  if (locale !== 'ka') return headingFmt[locale].format(d);
  return `${WEEKDAYS_KA[d.getDay()]}, ${d.getDate()} ${MONTHS_KA[d.getMonth()]}`;
};

const monthShortFmt = {
  en: new Intl.DateTimeFormat('en-US', { month: 'short' }),
  ru: new Intl.DateTimeFormat('ru-RU', { month: 'short' }),
} as const;
const weekdayShortFmt = {
  en: new Intl.DateTimeFormat('en-US', { weekday: 'short' }),
  ru: new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }),
} as const;
/** Date-tile parts for a Tbilisi instant: { day: 16, month: "სექ", weekday: "ოთხ" }. */
export const tbTileParts = (d: Date | string, locale: AppLocale = 'ka') => {
  const date = keyToDate(tbDayKey(d));
  return {
    day: date.getDate(),
    month: locale === 'ka' ? MONTHS_KA[date.getMonth()]!.slice(0, 3) : monthShortFmt[locale].format(date).replace('.', ''),
    weekday: locale === 'ka' ? WEEKDAYS_KA[date.getDay()]!.slice(0, 3) : weekdayShortFmt[locale].format(date),
  };
};
