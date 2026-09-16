import { formatDateKa, MONTHS_KA, WEEKDAYS_KA } from '@lokacia/contracts';

/** Asia/Tbilisi wall-clock helpers (server and browser render the same text). */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const tbDayKey = (d: Date | string) => dayFmt.format(new Date(d));
export const tbTime = (d: Date | string) => timeFmt.format(new Date(d));
/** "2026-09-16" → local Date at midnight (for Calendar, which uses local getters). */
export const keyToDate = (k: string) => {
  const [y, m, dd] = k.split('-').map(Number);
  return new Date(y!, m! - 1, dd!);
};
const pad = (n: number) => String(n).padStart(2, '0');
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const tbDateKa = (d: Date | string) => formatDateKa(keyToDate(tbDayKey(d)));
export const tbDateTimeKa = (d: Date | string) => `${tbDateKa(d)}, ${tbTime(d)}`;
export const dayHeadingKa = (key: string) => {
  const d = keyToDate(key);
  return `${WEEKDAYS_KA[d.getDay()]}, ${d.getDate()} ${MONTHS_KA[d.getMonth()]}`;
};
