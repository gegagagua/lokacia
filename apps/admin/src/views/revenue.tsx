'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { INVOICE_PURPOSE_LABELS_KA, MONTHS_KA, SUBSCRIPTION_STATUS_LABELS_KA, formatDateTimeKa, formatMoney, formatNumber, type AdminRevenue, type InvoicePurpose } from '@lokacia/contracts';
import { Stat } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { Bars, HBars } from '@/components/charts';

const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  const name = MONTHS_KA[Number(mm) - 1] ?? m;
  return `${String(name).slice(0, 3)} ${y?.slice(2) ?? ''}`;
};

export function RevenueView() {
  const t = useTranslations('revenue');
  const isAdmin = useIsAdmin();
  const { data, error, mutate } = useSWR<AdminRevenue>(isAdmin ? '/admin/revenue' : null, fetcher);
  if (!isAdmin) return <ErrorBlock error={new Error(t('adminOnly'))} />;
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={10} />;
  const money = (v: number) => formatMoney(v);
  const shortMoney = (v: number) => formatNumber(Math.round(v / 100));
  const subs = Object.values(data.subscriptionsByStatus).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('mrr')} value={money(data.mrrMinor)} />
        <Stat label={t('revenue30d')} value={money(data.revenue30dMinor)} />
        <Stat label={t('subscriptions')} value={subs} hint={t('activeCount', { count: data.subscriptionsByStatus.active ?? 0 })} />
        <Stat label={t('financeCommission')} value={money(data.financeCommissionMinor)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section title={t('byMonth')} className="lg:col-span-2">
          <Bars data={data.byMonth.map((m) => ({ label: monthLabel(m.month), value: m.amountMinor }))} format={shortMoney} label={t('byMonth')} />
          <p className="mt-2 text-[11px] text-muted">{t('byMonthHint')}</p>
        </Section>
        <Section title={t('subsByStatus')}>
          <HBars data={Object.entries(data.subscriptionsByStatus).map(([k, v]) => ({ label: SUBSCRIPTION_STATUS_LABELS_KA[k as keyof typeof SUBSCRIPTION_STATUS_LABELS_KA] ?? k, value: v }))} />
        </Section>
        <Section title={t('byProduct')}>
          <HBars data={data.byProduct.map((p) => ({ label: `${INVOICE_PURPOSE_LABELS_KA[p.purpose as InvoicePurpose] ?? p.purpose} · ${p.count}`, value: p.amountMinor }))} format={money} />
        </Section>
        <Section title={t('failed')} className="lg:col-span-2">
          {data.failedPayments.length === 0 ? (
            <p className="text-small text-muted">{t('noFailed')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[14px] tabular">
                <thead>
                  <tr className="border-b border-border-strong text-small text-muted">
                    <th scope="col" className="px-2 py-1.5 font-medium">{t('invoice')}</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">{t('payer')}</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">{t('amount')}</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">{t('provider')}</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">{t('attempts')}</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failedPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5 font-mono text-[13px]">{p.invoiceNumber}</td>
                      <td className="px-2 py-1.5">{p.payer ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{money(p.amountMinor)}</td>
                      <td className="px-2 py-1.5 font-mono text-[13px] uppercase">{p.provider}</td>
                      <td className="px-2 py-1.5 text-right">{p.attempts}</td>
                      <td className="px-2 py-1.5 text-small text-muted">{formatDateTimeKa(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
