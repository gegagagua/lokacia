'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { convertMinor, DISPLAY_CURRENCIES, type DisplayCurrency, type FxRatesResponse } from '@lokacia/contracts';
import { fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

const KEY = 'lk-currency';
const EVENT = 'lk-currency-change';

function readStored(): DisplayCurrency {
  try {
    const v = localStorage.getItem(KEY);
    return (DISPLAY_CURRENCIES as readonly string[]).includes(v ?? '') ? (v as DisplayCurrency) : 'GEL';
  } catch {
    return 'GEL';
  }
}

/** Display currency chosen by the visitor (GEL default) + current FX rates (GEL per unit). */
export function useDisplayCurrency() {
  const fmt = useFormat();
  const [currency, setCurrencyState] = React.useState<DisplayCurrency>('GEL');
  React.useEffect(() => {
    setCurrencyState(readStored());
    const on = () => setCurrencyState(readStored());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  const { data: fx } = useSWR<FxRatesResponse>(currency === 'GEL' ? null : '/fx/rates', fetcher, { revalidateOnFocus: false, dedupingInterval: 600_000 });
  const setCurrency = React.useCallback((c: DisplayCurrency) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* private mode */
    }
    setCurrencyState(c);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const format = React.useCallback(
    (minor: number) => (currency === 'GEL' || !fx ? fmt.money(minor) : fmt.money(Math.round(convertMinor(minor, currency, fx.rates)) * 100, currency)),
    [currency, fx, fmt],
  );
  return { currency, setCurrency, rates: fx?.rates ?? null, format };
}

/** Amount in tetri rendered in the visitor's display currency; GEL original in the title. */
export function Money({ minor, className }: { minor: number; className?: string }) {
  const { currency, format } = useDisplayCurrency();
  const fmt = useFormat();
  return (
    <span className={className} title={currency === 'GEL' ? undefined : fmt.money(minor)}>
      {format(minor)}
    </span>
  );
}

export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations('billing.currency');
  const { currency, setCurrency } = useDisplayCurrency();
  const id = React.useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {t('label')}
      </label>
      <select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as DisplayCurrency)} className="h-8 rounded-button border border-border bg-surface px-2 text-small tabular text-text">
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c === 'GEL' ? '₾ GEL' : c === 'USD' ? '$ USD' : '€ EUR'}
          </option>
        ))}
      </select>
    </div>
  );
}
