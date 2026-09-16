'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { InvoiceDto } from '@lokacia/contracts';
import { Button, Card } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

const RETURN_BY_PURPOSE: Record<string, string> = { vip: '/account/listings', report: '/reports', rent: '/account/property', escrow: '/account/billing', api: '/api-access' };

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

  return (
    <Card className="w-full max-w-md p-6 text-center" aria-live="polite">
      {state === 'paid' && <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.5} aria-hidden />}
      {state === 'failed' && <XCircle className="mx-auto size-12 text-danger" strokeWidth={1.5} aria-hidden />}
      {(state === 'pending' || state === 'loading') && <Clock className="mx-auto size-12 text-muted" strokeWidth={1.5} aria-hidden />}
      <h1 className="mt-3 text-h2 font-semibold">{state === 'unknown' ? t('unknown') : t(state)}</h1>
      <p className="mt-1 text-muted">{state === 'paid' ? t('paidText') : state === 'failed' ? t('failedText') : state === 'unknown' ? t('unknownText') : t('pendingText')}</p>
      {data && (
        <dl className="mt-5 flex flex-col text-left text-small">
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-muted">{t('invoice')}</dt>
            <dd className="tabular">{data.number}</dd>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-muted">{t('purpose')}</dt>
            <dd>{tp.has(data.purpose) ? tp(data.purpose) : data.purpose}</dd>
          </div>
          <div className="flex justify-between border-b border-border py-2">
            <dt className="text-muted">{t('amount')}</dt>
            <dd className="tabular">{data.amountMinor === 0 ? t('free') : fmt.money(data.amountMinor)}</dd>
          </div>
          {data.paidAt && (
            <div className="flex justify-between py-2">
              <dt className="text-muted">{t('paidAt')}</dt>
              <dd className="tabular">{fmt.dateTime(data.paidAt)}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="mt-6 flex flex-col gap-2">
        {state === 'failed' && data?.lastPaymentId && (
          <Button asChild>
            <a href={`/checkout/mock/${data.lastPaymentId}`}>{t('retry')}</a>
          </Button>
        )}
        {state === 'paid' && data && (
          <Button asChild variant="secondary">
            <a href={`/api/v1/billing/invoices/${data.id}/pdf`}>{t('receipt')}</a>
          </Button>
        )}
        <Button asChild variant={state === 'paid' ? 'primary' : 'secondary'}>
          <Link href={backHref}>{t('continue')}</Link>
        </Button>
        <Link href="/account/billing" className="text-small text-link hover:underline">
          {t('allInvoices')}
        </Link>
      </div>
    </Card>
  );
}
