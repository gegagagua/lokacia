import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Lock } from 'lucide-react';
import { formatMoney, INVOICE_PURPOSE_LABELS_KA, type PaymentSummary } from '@lokacia/contracts';
import { Badge, Card, Logo } from '@lokacia/ui';
import { api, ApiError } from '@/lib/api-server';
import { MockPayActions } from './mock-pay-actions';

export const metadata: Metadata = { title: 'სატესტო გადახდა', robots: { index: false, follow: false } };

export default async function MockCheckoutPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const t = await getTranslations('billing.mock');
  let payment: PaymentSummary;
  try {
    payment = await api<PaymentSummary>(`/v1/billing/payments/${paymentId}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(`/login?next=/checkout/mock/${paymentId}`);
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const done = payment.status === 'succeeded' || payment.status === 'refunded';
  return (
    <div className="drawing-grid min-h-[70dvh] py-10">
      <div className="container-page flex justify-center">
        <Card className="w-full max-w-md p-6">
          <div className="flex items-center justify-between gap-3">
            <Logo size={22} />
            <Badge tone="accent">{t('badge')}</Badge>
          </div>
          <p className="mt-2 text-small text-muted">{t('explain')}</p>
          <h1 className="mt-5 text-h3 font-semibold">{t('title')}</h1>
          <dl className="mt-3 flex flex-col text-small">
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted">{t('merchant')}</dt>
              <dd>lokacia.ge</dd>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted">{t('invoice')}</dt>
              <dd className="tabular">{payment.invoice.number}</dd>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted">{t('purpose')}</dt>
              <dd>{INVOICE_PURPOSE_LABELS_KA[payment.invoice.purpose] ?? payment.description}</dd>
            </div>
          </dl>
          <ul className="mt-2 flex flex-col text-small">
            {payment.invoice.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-1">
                <span>
                  {l.name}
                  {l.qty > 1 ? ` × ${l.qty}` : ''}
                </span>
                <span className="whitespace-nowrap tabular">{formatMoney(l.amountMinor)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="font-medium">{t('total')}</span>
            <span className="compact text-h2 font-semibold tabular">{formatMoney(payment.amountMinor)}</span>
          </div>

          <fieldset disabled className="mt-5 grid grid-cols-2 gap-3 opacity-70" aria-describedby="demo-card-hint">
            <label className="col-span-2 flex flex-col gap-1 text-small">
              {t('card')}
              <input className="h-10 rounded-button border border-border bg-surface-2 px-3 tabular" value="4242 4242 4242 4242" readOnly />
            </label>
            <label className="flex flex-col gap-1 text-small">
              {t('expiry')}
              <input className="h-10 rounded-button border border-border bg-surface-2 px-3 tabular" value="12/29" readOnly />
            </label>
            <label className="flex flex-col gap-1 text-small">
              CVC
              <input className="h-10 rounded-button border border-border bg-surface-2 px-3 tabular" value="123" readOnly />
            </label>
          </fieldset>
          <p id="demo-card-hint" className="mt-2 flex items-center gap-1.5 text-small text-muted">
            <Lock className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('cardHint')}
          </p>

          {done ? (
            <p role="status" className="mt-5 rounded-button border border-success px-3 py-2 text-small">
              {t('alreadyPaid')}
            </p>
          ) : (
            <MockPayActions paymentId={payment.id} amount={formatMoney(payment.amountMinor)} />
          )}
        </Card>
      </div>
    </div>
  );
}
