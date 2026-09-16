import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { toAppLocale } from '@lokacia/contracts';
import { createFormat } from './format';

/** Locale-bound formatters for client components and non-async server components. */
export function useFormat() {
  const locale = toAppLocale(useLocale());
  return useMemo(() => createFormat(locale), [locale]);
}
