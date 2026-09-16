'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Activity, BadgeCheck, Banknote, Building2, CheckCircle2, ChevronRight, ClipboardCheck, CreditCard, MessageSquare, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { formatMoney, formatNumber, LISTING_STATUS_LABELS_KA, type AdminDashboard, type ListingStatus } from '@lokacia/contracts';
import { Button, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { AreaChart, HBars, Sparkline } from '@/components/charts';
import { IconTile, InlineEmpty, KpiCard, type Tone } from '@/components/kit';
import { useIsAdmin, useSessionUser } from '@/lib/session-context';
import { shortDay } from '@/lib/format';

export function DashboardView() {
  const t = useTranslations('dashboard');
  const isAdmin = useIsAdmin();
  const me = useSessionUser();
  const { data, error, mutate } = useSWR<AdminDashboard>('/admin/dashboard', fetcher, { refreshInterval: 60_000 });
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={8} />;
  const queues: { href: string; label: string; value: number; icon: React.ElementType; tone: Tone }[] = [
    { href: '/moderation', label: t('queues.moderation'), value: data.queues.moderation, icon: ClipboardCheck, tone: 'accent' },
    { href: '/verifications', label: t('queues.verifications'), value: data.queues.verifications, icon: BadgeCheck, tone: 'primary' },
    { href: '/feedback', label: t('queues.feedback'), value: data.queues.feedback, icon: MessageSquare, tone: 'info' },
    { href: '/escrow', label: t('queues.disputes'), value: data.queues.disputes, icon: ShieldAlert, tone: 'danger' },
    ...(isAdmin ? [{ href: '/revenue', label: t('queues.failedPayments'), value: data.queues.failedPayments, icon: CreditCard, tone: 'danger' as Tone }] : []),
  ];
  const statuses = Object.entries(data.listingsByStatus).sort((a, b) => b[1] - a[1]);
  const totalListings = statuses.reduce((s, [, v]) => s + v, 0);
  const active = data.listingsByStatus.active ?? 0;
  const pendingReview = data.listingsByStatus.pending_review ?? 0;
  const signups30 = data.signupsByDay.reduce((s, d) => s + d.count, 0);
  const queueTotal = queues.reduce((s, q) => s + q.value, 0);

  return (
    <>
      <section className="hero-gradient relative mb-4 overflow-hidden rounded-card p-5 shadow-md sm:p-7 md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white/85 ring-1 ring-inset ring-white/15">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#7ee0c0] opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#7ee0c0]" />
              </span>
              {t('live')}
            </div>
            <h1 className="mt-3 text-[30px] font-bold leading-tight tracking-tight text-white md:text-[40px]">{t('title')}</h1>
            <p className="mt-2 text-[15px] text-white/80 md:text-[17px]">
              {me?.name ? `${t('greeting', { name: me.name.split(' ')[0] ?? me.name })} ` : ''}
              {queueTotal > 0 ? t('heroPending', { count: queueTotal }) : t('heroClear')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="accent">
                <Link href="/moderation">
                  <ClipboardCheck className="size-[18px]" strokeWidth={2} aria-hidden />
                  {t('openModeration')}
                </Link>
              </Button>
              <Link href="/verifications" className="inline-flex h-11 items-center gap-2 rounded-button bg-white/10 px-5 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15 focus-visible:shadow-ring focus-visible:outline-none">
                <BadgeCheck className="size-[18px]" strokeWidth={2} aria-hidden />
                {t('openVerifications')}
              </Link>
            </div>
          </div>
          <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:gap-3">
            {[
              { label: t('heroModeration'), value: data.queues.moderation },
              { label: t('heroVerifications'), value: data.queues.verifications },
              { label: t('heroDisputes'), value: data.queues.disputes },
            ].map((s) => (
              <div key={s.label} className="min-w-0 rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-inset ring-white/15 backdrop-blur sm:min-w-28 sm:px-4 sm:py-4">
                <dt className="text-[12px] font-medium leading-tight text-white/75 [overflow-wrap:anywhere] sm:text-[12.5px]">{s.label}</dt>
                <dd className="mt-1 text-[26px] font-bold leading-none tabular text-white sm:text-[32px]">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label={t('usersTotal')} value={formatNumber(data.usersTotal)} icon={Users} href="/users" hint={t('newUsers', { week: data.newUsers7d, month: data.newUsers30d })}>
          <Sparkline values={data.signupsByDay.map((d) => d.count)} label={t('signups')} height={36} />
        </KpiCard>
        <KpiCard label={t('activeListings')} value={formatNumber(active)} icon={Building2} tone="info" href="/moderation" hint={t('pendingHint', { count: pendingReview })}>
          <div className="flex items-center gap-2 text-small text-muted">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full bg-gradient-to-r from-link/50 to-link" style={{ width: `${totalListings ? (active / totalListings) * 100 : 0}%` }} />
            </span>
            <span className="tabular">{totalListings ? Math.round((active / totalListings) * 100) : 0}%</span>
          </div>
        </KpiCard>
        <KpiCard label={t('revenue30d')} value={formatMoney(data.revenue30dMinor)} icon={Banknote} tone="success" href={isAdmin ? '/revenue' : undefined} hint={t('revenueHint')} />
        <KpiCard label={t('mrr')} value={formatMoney(data.mrrMinor)} icon={TrendingUp} tone="accent" href={isAdmin ? '/revenue' : undefined} hint={t('mrrHint')} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          icon={Activity}
          title={t('signups')}
          description={t('signupsHint', { count: signups30 })}
        >
          <AreaChart data={data.signupsByDay.map((d) => ({ label: d.day, value: d.count }))} xLabel={(p) => shortDay(p.label)} label={t('signups')} format={(v) => formatNumber(v)} height={250} />
        </Section>

        <Section icon={ClipboardCheck} title={t('queuesTitle')} description={t('queuesHint', { count: queueTotal })} flush>
          <ul className="px-3 pb-3">
            {queues.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none">
                  <IconTile icon={q.icon} tone={q.value > 0 ? q.tone : 'neutral'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{q.label}</span>
                    <span className="block text-[13px] text-muted">{q.value > 0 ? t('queueWaiting') : t('queueClear')}</span>
                  </span>
                  {q.value > 0 ? (
                    <span className={cn('text-[22px] font-bold tabular', q.tone === 'danger' && 'text-danger')}>{formatNumber(q.value)}</span>
                  ) : (
                    <CheckCircle2 className="size-5 text-success" strokeWidth={2} aria-hidden />
                  )}
                  <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Section icon={Building2} title={t('listingsByStatus')} description={t('totalListings', { count: formatNumber(totalListings) })}>
          <HBars data={statuses.map(([k, v]) => ({ label: LISTING_STATUS_LABELS_KA[k as ListingStatus] ?? k, value: v }))} format={(v) => formatNumber(v)} className="sm:grid sm:grid-cols-2 sm:gap-x-8" />
        </Section>
        <Section icon={Activity} title={t('events')} description={t('eventsHint')}>
          {data.events7d.length ? (
            <HBars data={data.events7d.slice(0, 8).map((e) => ({ label: e.name, value: e.count }))} format={(v) => formatNumber(v)} className="[&_li>div>span:first-child]:font-mono [&_li>div>span:first-child]:text-[13.5px]" />
          ) : (
            <InlineEmpty icon={Activity}>{t('noEvents')}</InlineEmpty>
          )}
        </Section>
      </div>
    </>
  );
}
