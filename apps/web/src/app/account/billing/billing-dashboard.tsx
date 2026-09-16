'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download } from 'lucide-react';
import {
  type BillingOverview, type FinanceApplicationDto, type SubscriptionDto,
} from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Badge, Button, Card, EmptyState, Skeleton, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { MyReports } from '@/app/reports/my-reports';
import { EscrowList } from './escrow-list';

const SUB_TONE: Record<string, BadgeTone> = { active: 'success', pending: 'neutral', past_due: 'danger', grace: 'accent', cancelled: 'outline', expired: 'outline' };
const INV_TONE: Record<string, BadgeTone> = { paid: 'success', open: 'neutral', failed: 'danger', void: 'outline' };
const FIN_TONE: Record<string, BadgeTone> = { approved: 'success', rejected: 'danger', sent: 'link', submitted: 'neutral' };

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

  if (error) return <p className="mt-6 text-danger">{t('loadError')}</p>;

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-10 [&>*]:min-w-0">
      {data?.promoActive && (
        <p role="status" className="rounded-card border border-accent bg-accent/10 px-4 py-3 text-small">
          {t('promo', { date: data.promoUntil ? f.date(data.promoUntil) : '' })}
        </p>
      )}

      <section aria-labelledby="subs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="subs" className="text-h3 font-semibold md:text-h2">{t('subscriptions')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/pricing">{t('allPlans')}</Link>
          </Button>
        </div>
        {!data ? (
          <Skeleton className="mt-4 h-24" />
        ) : !data.subscriptions.length ? (
          <EmptyState className="mt-4" title={t('noSubs')} description={t('noSubsText')} action={<Button asChild><Link href="/pricing">{t('choosePlan')}</Link></Button>} />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.subscriptions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{s.planName}</div>
                    <div className="text-small text-muted">
                      {s.orgName ?? t('personal')}
                      {s.seats > 1 ? ` · ${t('seats', { n: s.seats })}` : ''} · {f.money(s.priceMinor)} {t('perMonth')}
                    </div>
                  </div>
                  <Badge tone={SUB_TONE[s.status] ?? 'neutral'}>{tl(`subscriptionStatus.${s.status}`)}</Badge>
                </div>
                {s.periodEnd && (
                  <p className="mt-3 text-small">
                    {s.cancelAtPeriodEnd ? t('endsOn', { date: f.date(s.periodEnd) }) : t('renewsOn', { date: f.date(s.periodEnd) })}
                  </p>
                )}
                {(s.status === 'past_due' || s.status === 'grace') && (
                  <p className="mt-2 flex items-start gap-2 rounded-button border border-danger/40 bg-danger/5 px-3 py-2 text-small">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
                    {t('graceWarning', { date: s.graceUntil ? f.date(s.graceUntil) : '—' })}
                  </p>
                )}
                {['active', 'past_due', 'grace'].includes(s.status) && (
                  <Button size="sm" variant={s.cancelAtPeriodEnd ? 'secondary' : 'ghost'} className="mt-3" onClick={() => toggleCancel(s)}>
                    {s.cancelAtPeriodEnd ? t('resume') : t('cancel')}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="text-h3 font-semibold md:text-h2">{t('invoices')}</h2>
        {!data ? (
          <Skeleton className="mt-4 h-40" />
        ) : !data.invoices.length ? (
          <p className="mt-2 text-muted">{t('noInvoices')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[640px] border-collapse bg-surface text-small">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="p-3 font-medium">{t('number')}</th>
                  <th scope="col" className="p-3 font-medium">{t('purpose')}</th>
                  <th scope="col" className="p-3 text-right font-medium">{t('amount')}</th>
                  <th scope="col" className="p-3 font-medium">{t('status')}</th>
                  <th scope="col" className="p-3 font-medium">{t('date')}</th>
                  <th scope="col" className="p-3"><span className="sr-only">{t('actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="p-3 tabular">{inv.number}</td>
                    <td className="p-3">
                      {tl.has(`invoicePurpose.${inv.purpose}`) ? tl(`invoicePurpose.${inv.purpose}`) : inv.purpose}
                      <div className="text-muted">{inv.lines.map((l) => l.name).join(', ')}</div>
                    </td>
                    <td className="p-3 text-right tabular">{f.money(inv.amountMinor)}</td>
                    <td className="p-3">
                      <Badge tone={INV_TONE[inv.status] ?? 'neutral'}>{tl(`invoiceStatus.${inv.status}`)}</Badge>
                    </td>
                    <td className="p-3 tabular">{f.date(inv.paidAt ?? inv.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {(inv.status === 'open' || inv.status === 'failed') && inv.lastPaymentId && (
                          <Button asChild size="sm">
                            <a href={`/checkout/mock/${inv.lastPaymentId}`}>{t('pay')}</a>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/api/v1/billing/invoices/${inv.id}/pdf`} aria-label={t('pdfFor', { number: inv.number })}>
                            <Download className="size-4" strokeWidth={1.5} aria-hidden />
                            PDF
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MyReports compact />

      <section aria-labelledby="escrow-h" id="escrow">
        <h2 id="escrow-h" className="text-h3 font-semibold md:text-h2">{t('escrow')}</h2>
        <p className="mt-1 text-small text-muted">{t('escrowText')}</p>
        <EscrowList />
      </section>

      <section aria-labelledby="finance-h" id="finance">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="finance-h" className="text-h3 font-semibold md:text-h2">{t('finance')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/finance">{t('financeAll')}</Link>
          </Button>
        </div>
        {!apps ? null : !apps.length ? (
          <p className="mt-2 text-muted">{t('noFinance')}</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {apps.map((a) => (
              <Card as="li" key={a.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.product.name}</div>
                    <div className="text-small text-muted">
                      {tl(`financeKind.${a.product.kind}`)} · {a.product.partner}
                    </div>
                  </div>
                  <Badge tone={FIN_TONE[a.status] ?? 'neutral'}>{tl(`financeStatus.${a.status}`)}</Badge>
                </div>
                <div className="mt-2 text-small tabular">
                  {f.money(a.amountMinor)}
                  {a.termMonths ? ` · ${t('months', { n: a.termMonths })}` : ''} · {f.date(a.createdAt)}
                </div>
                {a.listing && (
                  <Link href={`/listings/${a.listing.slug}`} className="mt-1 block text-small text-link hover:underline">
                    {a.listing.title}
                  </Link>
                )}
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
