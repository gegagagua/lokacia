'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlarmClock, CalendarDays, ChartLine, Plus } from 'lucide-react';
import type { KpiReport } from '@lokacia/contracts';
import { Button } from '@lokacia/ui';
import { KpiView } from '@/components/analytics/kpi-view';
import { PageHeader } from '@/components/common/page-header';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';

const DAY = 86_400_000;

/** C20 KPI dashboard (last 30 days) with quick links to today's work. */
export default function DashboardPage() {
  const t = useTranslations('analytics');
  const nav = useTranslations('shell.nav');
  const { org, user, can } = useCrm();
  const [range] = React.useState(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - 30 * DAY).toISOString(), to: to.toISOString() };
  });
  const { data } = useApi<KpiReport>(`/crm/analytics/kpi?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
  return (
    <div>
      <PageHeader
        title={t('dashboardTitle')}
        subtitle={`${org.name} · ${user.name ?? ''} · ${t('ranges.30')}`}
        actions={
          <>
            {can('analytics.view') && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/analytics">
                  <ChartLine className="size-4" strokeWidth={1.5} aria-hidden /> {t('openAnalytics')}
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/deals?new=1">
                <Plus className="size-4" strokeWidth={1.5} aria-hidden /> {nav('deals')}
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link href="/tasks" className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 hover:border-border-strong">
          <AlarmClock className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
          <span className="flex-1">{t('tiles.tasksOverdue')}</span>
          <span className="compact text-h3 font-semibold tabular">{data?.totals.tasksOverdue ?? '—'}</span>
        </Link>
        <Link href="/calendar" className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 hover:border-border-strong">
          <CalendarDays className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
          <span className="flex-1">{t('tiles.viewings')}</span>
          <span className="compact text-h3 font-semibold tabular">{data?.totals.viewings ?? '—'}</span>
        </Link>
      </div>
      <KpiView data={data} compact />
    </div>
  );
}
