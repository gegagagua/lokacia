'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Clock, Download, HelpCircle, RotateCcw, X } from 'lucide-react';
import type { InvoiceDto } from '@lokacia/contracts';
import { Button, cn, Skeleton } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

const RETURN_BY_PURPOSE: Record<string, string> = { vip: '/account/listings', report: '/reports', rent: '/account/property', escrow: '/account/billing', api: '/api-access' };

const STATE_STYLE = {
  paid: { icon: Check, ring: 'bg-success/12 text-success', halo: 'bg-success/20', band: 'from-success/15' },
  failed: { icon: X, ring: 'bg-danger/10 text-danger', halo: 'bg-danger/15', band: 'from-danger/12' },
  pending: { icon: Clock, ring: 'bg-link/10 text-link', halo: 'bg-link/15', band: 'from-link/10' },
  loading: { icon: Clock, ring: 'bg-surface-2 text-muted', halo: 'bg-surface-3', band: 'from-surface-2' },
  unknown: { icon: HelpCircle, ring: 'bg-surface-2 text-muted', halo: 'bg-surface-3', band: 'from-surface-2' },
} as const;

export function ResultView({ invoiceId, failedHint, back }: { invoiceId: string | null; failedHint: boolean; back: string | null }) {
  const t = useTranslations('billing.result');
  const tp = useTranslations('billing.purposes');
  const fmt = useFormat();
  const [polls, setPolls] = React.useState(0);
  const { data, error } = useSWR<InvoiceDto>(invoiceId ? `/billing/invoices/${invoiceId}` : null, fetcher, {
    refreshInterval: (d) => (d && d.status === 'open' && !failedHint && polls < 10 ? 2000 : 0),
    onSuccess: () => setPolls((p) => p + 1),
  });
  const state = !invoiceId || error ? 'unknown' : !data ? 'loading' : data.status === 'paid' ? 'paid' : data.status === 'failed' || failedHint ? 'failed' : 'pending';
  const backHref = back ?? (data ? (RETURN_BY_PURPOSE[data.purpose] ?? '/account/billing') : '/account/billing');
  const s = STATE_STYLE[state];
  const Icon = s.icon;

  return (
    <div className="relative w-full max-w-lg overflow-hidden rounded-modal border border-border bg-surface shadow-lg" aria-live="polite">
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent', s.band)} />
      <div className="relative px-6 pb-6 pt-10 text-center md:px-10">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span aria-hidden className={cn('absolute inset-0 rounded-full', s.halo, state === 'pending' || state === 'loading' ? 'animate-ping opacity-40' : 'scale-125 opacity-60')} />
          <span className={cn('relative grid size-20 place-items-center rounded-full ring-8 ring-surface', s.ring)}>
            <Icon className={cn('size-9', state === 'loading' && 'animate-pulse')} strokeWidth={2.5} aria-hidden />
          </span>
        </div>
        <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">{state === 'unknown' ? t('unknown') : t(state)}</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">{state === 'paid' ? t('paidText') : state === 'failed' ? t('failedText') : state === 'unknown' ? t('unknownText') : t('pendingText')}</p>

        {state === 'loading' && <Skeleton className="mt-6 h-40 rounded-2xl" />}
        {data && (
          <dl className="mt-7 rounded-2xl border border-border bg-surface-2/70 px-5 py-2 text-left text-[15px]">
            <div className="flex justify-between gap-4 border-b border-dashed border-border-strong py-3">
              <dt className="text-muted">{t('amount')}</dt>
              <dd className={cn('text-right font-bold tabular', data.amountMinor === 0 ? 'text-success' : 'text-[20px]')}>{data.amountMinor === 0 ? t('free') : fmt.money(data.amountMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{t('purpose')}</dt>
              <dd className="text-right font-medium">{tp.has(data.purpose) ? tp(data.purpose) : data.purpose}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{t('invoice')}</dt>
              <dd className="font-medium tabular">{data.number}</dd>
            </div>
            {data.paidAt && (
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{t('paidAt')}</dt>
                <dd className="font-medium tabular">{fmt.dateTime(data.paidAt)}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-7 flex flex-col gap-2.5">
          {state === 'failed' && data?.lastPaymentId && (
            <Button asChild size="lg">
              <a href={`/checkout/mock/${data.lastPaymentId}`}>
                <RotateCcw className="size-4" strokeWidth={2} aria-hidden />
                {t('retry')}
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant={state === 'paid' ? 'primary' : 'secondary'}>
            <Link href={backHref}>
              {t('continue')}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
          {state === 'paid' && data && (
            <Button asChild variant="secondary">
              <a href={`/api/v1/billing/invoices/${data.id}/pdf`}>
                <Download className="size-4" strokeWidth={2} aria-hidden />
                {t('receipt')}
              </a>
            </Button>
          )}
          <Link href="/account/billing" className="mt-1 text-small font-medium text-link hover:underline">
            {t('allInvoices')}
          </Link>
        </div>
      </div>
    </div>
  );
}
