import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, CreditCard, FlaskConical, Lock, ShieldCheck } from 'lucide-react';
import type { PaymentSummary } from '@lokacia/contracts';
import { getAppLocale, getFormat } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { Logo } from '@lokacia/ui';
import { api, ApiError } from '@/lib/api-server';
import { MockPayActions } from './mock-pay-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('testPayment'), robots: { index: false, follow: false } };
}

export default async function MockCheckoutPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const t = await getTranslations('billing.mock');
  const tp = await getTranslations('billing.purposes');
  const fmt = await getFormat();
  let payment: PaymentSummary;
  try {
    payment = await api<PaymentSummary>(`/v1/billing/payments/${paymentId}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(localizePath(`/login?next=/checkout/mock/${paymentId}`, await getAppLocale()));
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const done = payment.status === 'succeeded' || payment.status === 'refunded';
  const purpose = tp.has(payment.invoice.purpose) ? tp(payment.invoice.purpose) : payment.description;
  const inputCls = 'h-12 w-full rounded-button border border-border bg-surface-2 px-3.5 text-[15px] text-text tabular';

  return (
    <div className="relative min-h-[80dvh] overflow-hidden py-10 md:py-16">
      <div aria-hidden className="drawing-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="container-page relative">
        <div className="mx-auto mb-5 flex max-w-4xl items-center justify-center gap-2 rounded-full border border-accent/50 bg-accent-soft px-4 py-2 text-small font-medium text-[#6b4700] dark:text-accent sm:w-fit">
          <FlaskConical className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            <b className="font-semibold">{t('badge')}</b> · {t('explain')}
          </span>
        </div>

        <div className="mx-auto grid max-w-4xl overflow-hidden rounded-modal border border-border bg-surface shadow-lg md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Order summary */}
          <aside aria-labelledby="order-h" className="relative flex flex-col border-b border-border bg-surface-2 p-6 md:border-b-0 md:border-r md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Logo size={22} />
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[13px] font-semibold text-success shadow-xs ring-1 ring-border">
                <Lock className="size-3.5" strokeWidth={2.5} aria-hidden />
                {t('secure')}
              </span>
            </div>
            <h2 id="order-h" className="mt-8 text-small font-semibold text-muted">
              {t('summary')}
            </h2>
            <p className="mt-1 text-[20px] font-bold leading-tight tracking-tight">{purpose}</p>
            <div className="mt-4 text-[40px] font-bold leading-none tracking-tight tabular">{fmt.money(payment.amountMinor)}</div>

            <ul className="mt-6 flex flex-col gap-2 text-[15px]">
              {payment.invoice.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {l.name}
                    {l.qty > 1 ? <span className="text-muted"> × {l.qty}</span> : ''}
                  </span>
                  <span className="whitespace-nowrap font-medium tabular">{fmt.money(l.amountMinor)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 flex flex-col border-t border-dashed border-border-strong pt-4 text-small">
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">{t('merchant')}</dt>
                <dd className="font-medium">lokacia.ge</dd>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">{t('invoice')}</dt>
                <dd className="font-medium tabular">{payment.invoice.number}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1">
                <dt className="text-muted">{t('purpose')}</dt>
                <dd className="text-right font-medium">{purpose}</dd>
              </div>
            </dl>
            <div className="mt-auto flex items-baseline justify-between border-t border-border-strong pt-4 max-md:mt-5 md:mt-8">
              <span className="font-semibold">{t('total')}</span>
              <span className="text-[24px] font-bold tracking-tight tabular">{fmt.money(payment.amountMinor)}</span>
            </div>
          </aside>

          {/* Payment form */}
          <section aria-labelledby="pay-h" className="p-6 md:p-8">
            <h1 id="pay-h" className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
              <CreditCard className="size-5 text-primary-soft-text" strokeWidth={2} aria-hidden />
              {t('title')}
            </h1>

            <div aria-hidden className="relative mt-5 aspect-[1.7] w-full max-w-[340px] overflow-hidden rounded-2xl p-5 text-white shadow-md hero-gradient">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -left-6 size-44 rounded-full bg-[#f0bd3a]/15" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="h-7 w-10 rounded-md bg-gradient-to-br from-[#f7d67a] to-[#c9921a]" />
                  <span className="text-small font-semibold tracking-wide text-white/80">DEMO</span>
                </div>
                <div className="whitespace-nowrap font-mono text-[16px] tracking-[0.08em] sm:text-[19px] sm:tracking-[0.12em]">4242 4242 4242 4242</div>
                <div className="flex justify-between text-small text-white/80">
                  <span>lokacia.ge</span>
                  <span className="tabular">12/29</span>
                </div>
              </div>
            </div>

            <fieldset disabled className="mt-6 grid grid-cols-2 gap-3" aria-describedby="demo-card-hint">
              <label className="col-span-2 flex flex-col gap-1.5 text-small font-medium">
                {t('card')}
                <input className={inputCls} value="4242 4242 4242 4242" readOnly />
              </label>
              <label className="flex flex-col gap-1.5 text-small font-medium">
                {t('expiry')}
                <input className={inputCls} value="12/29" readOnly />
              </label>
              <label className="flex flex-col gap-1.5 text-small font-medium">
                CVC
                <input className={inputCls} value="123" readOnly />
              </label>
            </fieldset>
            <p id="demo-card-hint" className="mt-2.5 flex items-center gap-1.5 text-small text-muted">
              <Lock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {t('cardHint')}
            </p>

            {done ? (
              <p role="status" className="mt-6 flex items-center gap-2.5 rounded-2xl bg-success/12 px-4 py-3 font-medium text-text">
                <CheckCircle2 className="size-5 shrink-0 text-success" strokeWidth={2} aria-hidden />
                {t('alreadyPaid')}
              </p>
            ) : (
              <MockPayActions paymentId={payment.id} amount={fmt.money(payment.amountMinor)} />
            )}

            <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-small text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
              {t('secureNote')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
