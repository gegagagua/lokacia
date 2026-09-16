'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MONTHS_KA, WEEKDAYS_KA } from '@lokacia/contracts';

/** Locale-aware date helpers that do not rely on ICU data for Georgian (headless/older engines lack `ka`). */
export function useDateFormat() {
  const locale = useLocale();
  const t = useTranslations('analytics.rel');
  return React.useMemo(() => {
    const intl = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
    return {
      dayLine: (d: Date) => (locale === 'ka' ? `${WEEKDAYS_KA[d.getDay()]}, ${d.getDate()} ${MONTHS_KA[d.getMonth()]}` : intl({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)),
      shortDate: (iso: string) => {
        const d = new Date(iso);
        return locale === 'ka' ? `${d.getDate()} ${MONTHS_KA[d.getMonth()]!.slice(0, 3)}` : intl({ day: 'numeric', month: 'short' }).format(d);
      },
      time: (iso: string) => {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      },
      rel: (iso: string) => {
        const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 60) return t('justNow');
        if (s < 3600) return t('minutes', { n: Math.round(s / 60) });
        if (s < 86400) return t('hours', { n: Math.round(s / 3600) });
        if (s < 86400 * 30) return t('days', { n: Math.round(s / 86400) });
        return t('months', { n: Math.round(s / (86400 * 30)) });
      },
    };
  }, [locale, t]);
}
