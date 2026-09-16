import { relativeDaysFor, type AppLocale } from '@lokacia/contracts';

/** Shift a UTC instant so local-time formatters (formatDateTimeKa) print Asia/Tbilisi (UTC+4, no DST) wall time. */
export function tbilisi(input: string | Date): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(d.getTime() + 4 * 3600_000 + d.getTimezoneOffset() * 60_000);
}

export function relativeKa(input: string | Date, locale: AppLocale = 'ka') {
  return relativeDaysFor(input, locale);
}
