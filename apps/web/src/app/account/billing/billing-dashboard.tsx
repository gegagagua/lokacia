'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarClock, CircleDollarSign, Download, FileText, Landmark, Receipt, Repeat, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { type BillingOverview, type FinanceApplicationDto, type InvoiceDto, type SubscriptionDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Badge, Button, cn, EmptyState, Skeleton, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { MyReports } from '@/app/reports/my-reports';
import { PartnerLogo } from '@/components/billing/partner-logo';
import { EscrowList } from './escrow-list';
import { withBase } from '@/lib/base-path';

const SUB_TONE: Record<string, BadgeTone> = { active: 'success', pending: 'neutral', past_due: 'danger', grace: 'accent', cancelled: 'outline', expired: 'outline' };
const INV_TONE: Record<string, BadgeTone> = { paid: 'success', open: 'neutral', failed: 'danger', void: 'outline' };
const FIN_TONE: Record<string, BadgeTone> = { approved: 'success', rejected: 'danger', sent: 'link', submitted: 'neutral' };

function SectionHead({ id, icon: Icon, title, text, action }: { id: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
          <Icon className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-[22px] font-bold leading-tight tracking-tight md:text-[24px]">
            {title}
          </h2>
          {text && <p className="mt-0.5 text-small text-muted">{text}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function BillingDashboard() {
  const t = useTranslations('billing.account');
  const f = useFormat();
  const tl = useTranslations('account.billingLabels');
  const toast = useToast();
  const { data, mutate, error } = useSWR<BillingOverview>('/billing/overview', fetcher);
  const { data: apps } = useSWR<FinanceApplicationDto[]>('/finance/applications', fetcher);

  const toggleCancel = async (s: SubscriptionDto) => {
    if (!s.cancelAtPeriodEnd && !window.confirm(t('cancelConfirm'))) return;
    try {
      await apiFetch(`/billing/subscriptions/${s.id}/${s.cancelAtPeriodEnd ? 'resume' : 'cancel'}`, { method: 'POST' });
      toast({ title: s.cancelAtPeriodEnd ? t('resumed') : t('cancelled'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: t('error'), description: e instanceof ClientApiError ? e.message : undefined, tone: 'danger' });
    }
  };

  if (error)
    return (
      <p role="alert" className="mt-6 flex items-center gap-2 rounded-card bg-danger/10 px-4 py-3 text-danger">
        <AlertTriangle className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        {t('loadError')}
      </p>
    );

  const activeSubs = data?.subscriptions.filter((s) => ['active', 'past_due', 'grace'].includes(s.status)) ?? [];
  const due = data?.invoices.filter((i) => i.status === 'open' || i.status === 'failed') ?? [];
  const dueMinor = due.reduce((a, i) => a + i.amountMinor, 0);
  const paidMinor = data?.invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amountMinor, 0) ?? 0;
  const nextRenewal = activeSubs.filter((s) => s.periodEnd && !s.cancelAtPeriodEnd).map((s) => s.periodEnd!).sort()[0];

  const kpis = [
    { icon: Repeat, label: t('kpiSubs'), value: f.number(activeSubs.length), hint: nextRenewal ? t('renewsOn', { date: f.date(nextRenewal) }) : undefined, tone: 'primary' },
    { icon: CircleDollarSign, label: t('kpiDue'), value: f.money(dueMinor), hint: t('kpiDueHint', { n: due.length }), tone: dueMinor ? 'danger' : 'success' },
    { icon: Receipt, label: t('kpiPaid'), value: f.money(paidMinor), hint: t('kpiInvoices', { n: data?.invoices.length ?? 0 }), tone: 'link' },
  ] as const;
  const toneCls = { primary: 'bg-primary-soft text-primary-soft-text', danger: 'bg-danger/10 text-danger', success: 'bg-success/12 text-success', link: 'bg-link/10 text-link' } as const;

  return (
    <div className="mt-8 flex min-w-0 flex-col gap-12 [&>*]:min-w-0">
      {data?.promoActive && (
        <div role="status" className="hero-gradient relative flex items-center gap-4 overflow-hidden rounded-card px-5 py-4 shadow-md">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 text-[#f7d67a] ring-1 ring-white/20">
            <Sparkles className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 font-medium">{t('promo', { date: data.promoUntil ? f.date(data.promoUntil) : '' })}</p>
          <Link href="/pricing" className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/12 px-3.5 py-1.5 text-small font-semibold ring-1 ring-white/20 transition-colors hover:bg-white/20 sm:inline-flex">
            {t('allPlans')}
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ icon: Icon, label, value, hint, tone }) =>
          !data ? (
            <Skeleton key={label} className="h-[132px] rounded-card" />
          ) : (
            <div key={label} className="card flex flex-col p-5">
              <dt className="flex items-center justify-between gap-2 text-small font-medium text-muted">
                {label}
                <span className={cn('grid size-9 place-items-center rounded-xl', toneCls[tone])}>
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                </span>
              </dt>
              <dd className="mt-2 text-[30px] font-bold leading-tight tracking-tight tabular">{value}</dd>
              {hint && <dd className="mt-0.5 text-small text-muted">{hint}</dd>}
            </div>
          ),
        )}
      </dl>

      <section aria-labelledby="subs">
        <SectionHead
          id="subs"
          icon={Repeat}
          title={t('subscriptions')}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/pricing">
                {t('allPlans')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </Button>
          }
        />
        {!data ? (
          <Skeleton className="mt-5 h-40 rounded-card" />
        ) : !data.subscriptions.length ? (
          <EmptyState className="mt-5" icon={<Repeat className="size-6" strokeWidth={2} aria-hidden />} title={t('noSubs')} description={t('noSubsText')} action={<Button asChild><Link href="/pricing">{t('choosePlan')}</Link></Button>} />
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.subscriptions.map((s) => {
              const live = ['active', 'past_due', 'grace'].includes(s.status);
              return (
                <article key={s.id} className={cn('relative flex flex-col overflow-hidden rounded-card border bg-surface p-5 shadow-sm md:p-6', live ? 'border-border' : 'border-dashed border-border-strong')}>
                  {s.status === 'active' && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-primary to-accent" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">
                        <BadgeCheck className="size-5" strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[18px] font-bold">{s.planName}</h3>
                        <div className="truncate text-small text-muted">
                          {s.orgName ?? t('personal')}
                          {s.seats > 1 ? ` · ${t('seats', { n: s.seats })}` : ''}
                        </div>
                      </div>
                    </div>
                    <Badge tone={SUB_TONE[s.status] ?? 'neutral'}>{tl(`subscriptionStatus.${s.status}`)}</Badge>
                  </div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-[30px] font-bold leading-none tracking-tight tabular">{f.money(s.priceMinor)}</span>
                    <span className="text-small text-muted">{t('perMonth')}</span>
                  </div>
                  {s.periodEnd && (
                    <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-small">
                      <CalendarClock className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                      {s.cancelAtPeriodEnd ? t('endsOn', { date: f.date(s.periodEnd) }) : t('renewsOn', { date: f.date(s.periodEnd) })}
                    </p>
                  )}
                  {(s.status === 'past_due' || s.status === 'grace') && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-small text-danger">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
                      {t('graceWarning', { date: s.graceUntil ? f.date(s.graceUntil) : '—' })}
                    </p>
                  )}
                  {live && (
                    <div className="mt-4 flex justify-end border-t border-border pt-4">
                      <Button size="sm" variant={s.cancelAtPeriodEnd ? 'primary' : 'ghost'} className={s.cancelAtPeriodEnd ? '' : 'text-muted hover:text-danger'} onClick={() => toggleCancel(s)}>
                        {s.cancelAtPeriodEnd ? t('resume') : t('cancel')}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="invoices">
        <SectionHead id="invoices" icon={FileText} title={t('invoices')} />
        {!data ? (
          <Skeleton className="mt-5 h-56 rounded-card" />
        ) : !data.invoices.length ? (
          <p className="mt-5 rounded-card border border-dashed border-border-strong bg-surface px-5 py-6 text-muted">{t('noInvoices')}</p>
        ) : (
          <div className="card mt-5 overflow-hidden">
            {/* Mobile: stacked rows */}
            <ul className="divide-y divide-border xl:hidden">
              {data.invoices.map((inv) => (
                <li key={inv.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{purposeLabel(tl, inv)}</div>
                      <div className="text-small text-muted tabular">
                        {inv.number} · {f.date(inv.paidAt ?? inv.createdAt)}
                      </div>
                    </div>
                    <div className="text-right font-bold tabular">{f.money(inv.amountMinor)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge tone={INV_TONE[inv.status] ?? 'neutral'}>{tl(`invoiceStatus.${inv.status}`)}</Badge>
                    <InvoiceActions inv={inv} />
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[760px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-small text-muted">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      {t('number')} · {t('date')}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t('purpose')}</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">{t('amount')}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{t('status')}</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{t('actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface-2/60">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="font-mono text-[13px] tabular">{inv.number}</div>
                        <div className="text-small text-muted tabular">
                          <span className="sr-only">{t('date')}: </span>
                          {f.date(inv.paidAt ?? inv.createdAt)}
                        </div>
                      </td>
                      <td className="max-w-[260px] px-5 py-4">
                        <div className="font-medium">{purposeLabel(tl, inv)}</div>
                        <div className="line-clamp-1 text-small text-muted">{inv.lines.map((l) => l.name).join(', ')}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular">{f.money(inv.amountMinor)}</td>
                      <td className="px-5 py-4">
                        <Badge tone={INV_TONE[inv.status] ?? 'neutral'}>{tl(`invoiceStatus.${inv.status}`)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <InvoiceActions inv={inv} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <MyReports compact />

      <section aria-labelledby="escrow-h" id="escrow" className="scroll-mt-24">
        <SectionHead id="escrow-h" icon={ShieldCheck} title={t('escrow')} text={t('escrowText')} />
        <EscrowList />
      </section>

      <section aria-labelledby="finance-h" id="finance" className="scroll-mt-24">
        <SectionHead
          id="finance-h"
          icon={Landmark}
          title={t('finance')}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/finance">
                {t('financeAll')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </Button>
          }
        />
        {!apps ? (
          <Skeleton className="mt-5 h-32 rounded-card" />
        ) : !apps.length ? (
          <p className="mt-5 rounded-card border border-dashed border-border-strong bg-surface px-5 py-6 text-muted">{t('noFinance')}</p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {apps.map((a) => (
              <li key={a.id} className="card card-hover flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <PartnerLogo name={a.product.partner} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{a.product.name}</div>
                    <div className="text-small text-muted">
                      {tl(`financeKind.${a.product.kind}`)} · {a.product.partner}
                    </div>
                  </div>
                  <Badge tone={FIN_TONE[a.status] ?? 'neutral'}>{tl(`financeStatus.${a.status}`)}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[24px] font-bold tracking-tight tabular">{f.money(a.amountMinor)}</span>
                  <span className="text-small text-muted tabular">
                    {a.termMonths ? `${t('months', { n: a.termMonths })} · ` : ''}
                    {f.date(a.createdAt)}
                  </span>
                </div>
                {a.listing && (
                  <Link href={`/listings/${a.listing.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-small font-medium text-link hover:underline">
                    <Wallet className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="truncate">{a.listing.title}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function purposeLabel(tl: ReturnType<typeof useTranslations>, inv: InvoiceDto) {
  return tl.has(`invoicePurpose.${inv.purpose}`) ? tl(`invoicePurpose.${inv.purpose}`) : inv.purpose;
}

function InvoiceActions({ inv }: { inv: InvoiceDto }) {
  const t = useTranslations('billing.account');
  return (
    <div className="flex justify-end gap-1.5">
      {(inv.status === 'open' || inv.status === 'failed') && inv.lastPaymentId && (
        <Button asChild size="sm">
          <a href={withBase(`/checkout/mock/${inv.lastPaymentId}`)}>{t('pay')}</a>
        </Button>
      )}
      <Button asChild size="sm" variant="secondary" className="px-2.5">
        <a href={withBase(`/api/v1/billing/invoices/${inv.id}/pdf`)} aria-label={t('pdfFor', { number: inv.number })} title={t('pdfFor', { number: inv.number })}>
          <Download className="size-4" strokeWidth={2} aria-hidden />
          <span className="text-[13px]">PDF</span>
        </a>
      </Button>
    </div>
  );
}
