'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Banknote, CalendarRange, CreditCard, Landmark, Package, PieChart, Repeat, TrendingUp } from 'lucide-react';
import { INVOICE_PURPOSE_LABELS_KA, SUBSCRIPTION_STATUS_LABELS_KA, formatDateTimeKa, formatMoney, formatNumber, type AdminRevenue, type InvoicePurpose } from '@lokacia/contracts';
import { fetcher } from '@/lib/api-client';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { BarChart, HBars } from '@/components/charts';
import { InlineEmpty, KpiCard, StatusPill, TableCard, THead, td, th, tr } from '@/components/kit';
import { shortMonth } from '@/lib/format';

export function RevenueView() {
  const t = useTranslations('revenue');
  const isAdmin = useIsAdmin();
  const { data, error, mutate } = useSWR<AdminRevenue>(isAdmin ? '/admin/revenue' : null, fetcher);
  if (!isAdmin) return <ErrorBlock error={new Error(t('adminOnly'))} />;
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={10} />;
  const money = (v: number) => formatMoney(v);
  const shortMoney = (v: number) => `${formatNumber(Math.round(v / 100))} ₾`;
  const subs = Object.values(data.subscriptionsByStatus).reduce((a, b) => a + b, 0);
  const months = data.byMonth.map((m) => ({ label: shortMonth(m.month), value: m.amountMinor }));
  const yearTotal = data.byMonth.reduce((s, m) => s + m.amountMinor, 0);
  return (
    <>
      <PageHeader icon={Banknote} title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label={t('mrr')} value={money(data.mrrMinor)} icon={Repeat} tone="primary" />
        <KpiCard
          label={t('revenue30d')}
          value={money(data.revenue30dMinor)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard label={t('subscriptions')} value={formatNumber(subs)} icon={CreditCard} tone="info" hint={t('activeCount', { count: data.subscriptionsByStatus.active ?? 0 })} />
        <KpiCard label={t('financeCommission')} value={money(data.financeCommissionMinor)} icon={Landmark} tone="accent" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          icon={CalendarRange}
          title={t('byMonth')}
          description={t('byMonthHint')}
          actions={
            <div className="text-right">
              <div className="text-[12.5px] text-muted">{t('periodTotal')}</div>
              <div className="text-[18px] font-bold tabular">{money(yearTotal)}</div>
            </div>
          }
        >
          <BarChart data={months} format={shortMoney} label={t('byMonth')} height={280} />
        </Section>
        <Section icon={PieChart} title={t('subsByStatus')}>
          {Object.keys(data.subscriptionsByStatus).length ? (
            <HBars data={Object.entries(data.subscriptionsByStatus).map(([k, v]) => ({ label: SUBSCRIPTION_STATUS_LABELS_KA[k as keyof typeof SUBSCRIPTION_STATUS_LABELS_KA] ?? k, value: v }))} />
          ) : (
            <InlineEmpty icon={PieChart}>—</InlineEmpty>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Section icon={Package} title={t('byProduct')}>
          <HBars data={data.byProduct.map((p) => ({ label: `${INVOICE_PURPOSE_LABELS_KA[p.purpose as InvoicePurpose] ?? p.purpose} · ${p.count}`, value: p.amountMinor }))} format={money} />
        </Section>
        <Section
          className="xl:col-span-2"
          icon={AlertTriangle}
          title={t('failed')}
          actions={data.failedPayments.length > 0 ? <StatusPill tone="danger">{data.failedPayments.length}</StatusPill> : undefined}
          flush={data.failedPayments.length > 0}
        >
          {data.failedPayments.length === 0 ? (
            <InlineEmpty icon={AlertTriangle}>{t('noFailed')}</InlineEmpty>
          ) : (
            <TableCard flat minWidth={640} label={t('failed')}>
              <THead>
                <th scope="col" className={th}>{t('invoice')}</th>
                <th scope="col" className={th}>{t('payer')}</th>
                <th scope="col" className={`${th} text-right`}>{t('amount')}</th>
                <th scope="col" className={th}>{t('provider')}</th>
                <th scope="col" className={`${th} text-right`}>{t('attempts')}</th>
                <th scope="col" className={th}>{t('date')}</th>
              </THead>
              <tbody>
                {data.failedPayments.map((p) => (
                  <tr key={p.id} className={tr}>
                    <td className={`${td} font-mono text-[13.5px] font-semibold`}>{p.invoiceNumber}</td>
                    <td className={td}>{p.payer ?? '—'}</td>
                    <td className={`${td} text-right font-bold`}>{money(p.amountMinor)}</td>
                    <td className={td}>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] font-semibold uppercase">{p.provider}</span>
                    </td>
                    <td className={`${td} text-right`}>
                      <StatusPill tone={p.attempts > 2 ? 'danger' : 'accent'} dot={false}>
                        {p.attempts}
                      </StatusPill>
                    </td>
                    <td className={`${td} text-muted`}>{formatDateTimeKa(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </Section>
      </div>
    </>
  );
}
