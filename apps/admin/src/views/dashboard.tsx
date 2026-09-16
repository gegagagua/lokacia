'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { formatMoney, formatNumber, LISTING_STATUS_LABELS_KA, type AdminDashboard, type ListingStatus } from '@lokacia/contracts';
import { Stat } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { HBars, Sparkline } from '@/components/charts';
import { useIsAdmin } from '@/lib/session-context';

export function DashboardView() {
  const t = useTranslations('dashboard');
  const isAdmin = useIsAdmin();
  const { data, error, mutate } = useSWR<AdminDashboard>('/admin/dashboard', fetcher, { refreshInterval: 60_000 });
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={8} />;
  const queues = [
    { href: '/moderation', label: t('queues.moderation'), value: data.queues.moderation },
    { href: '/verifications', label: t('queues.verifications'), value: data.queues.verifications },
    { href: '/feedback', label: t('queues.feedback'), value: data.queues.feedback },
    { href: '/escrow', label: t('queues.disputes'), value: data.queues.disputes },
    ...(isAdmin ? [{ href: '/revenue', label: t('queues.failedPayments'), value: data.queues.failedPayments }] : []),
  ];
  const statuses = Object.entries(data.listingsByStatus).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('usersTotal')} value={formatNumber(data.usersTotal)} hint={t('newUsers', { week: data.newUsers7d, month: data.newUsers30d })} />
        <Stat label={t('activeListings')} value={formatNumber(data.listingsByStatus.active ?? 0)} hint={t('pendingHint', { count: data.listingsByStatus.pending_review ?? 0 })} />
        <Stat label={t('revenue30d')} value={formatMoney(data.revenue30dMinor)} />
        <Stat label={t('mrr')} value={formatMoney(data.mrrMinor)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section title={t('queuesTitle')}>
          <ul className="flex flex-col">
            {queues.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="flex items-center justify-between border-b border-border py-2 text-[15px] last:border-b-0 hover:text-link">
                  <span>{q.label}</span>
                  <span className={`tabular font-semibold ${q.value > 0 ? 'text-text' : 'text-muted'}`}>{q.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={t('listingsByStatus')}>
          <HBars data={statuses.map(([k, v]) => ({ label: LISTING_STATUS_LABELS_KA[k as ListingStatus] ?? k, value: v }))} />
        </Section>
        <Section title={t('signups')}>
          <Sparkline values={data.signupsByDay.map((d) => d.count)} label={t('signups')} />
          <div className="mt-1 flex justify-between text-[11px] text-muted tabular">
            <span>{data.signupsByDay[0]?.day ?? ''}</span>
            <span>{data.signupsByDay.at(-1)?.day ?? ''}</span>
          </div>
          <h3 className="mt-4 mb-2 text-small font-medium">{t('events')}</h3>
          {data.events7d.length ? <HBars data={data.events7d.slice(0, 8).map((e) => ({ label: e.name, value: e.count }))} /> : <p className="text-small text-muted">{t('noEvents')}</p>}
        </Section>
      </div>
    </>
  );
}
