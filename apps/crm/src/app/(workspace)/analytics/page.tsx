'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarRange, Target } from 'lucide-react';
import type { KpiReport } from '@lokacia/contracts';
import { Button, Field, Input } from '@lokacia/ui';
import { KpiView } from '@/components/analytics/kpi-view';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { RequirePerm } from '@/components/common/require-perm';
import { ChipGroup } from '@/components/common/ui';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS = ['30', '90', '180', '365'] as const;

export default function AnalyticsPage() {
  return (
    <RequirePerm perm="analytics.view">
      <Analytics />
    </RequirePerm>
  );
}

function Analytics() {
  const t = useTranslations('analytics');
  const { can } = useCrm();
  const [from, setFrom] = React.useState(() => iso(new Date(Date.now() - 90 * DAY)));
  const [to, setTo] = React.useState(() => iso(new Date()));
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  const qs = new URLSearchParams({ from: fromDate.toISOString(), to: toDate.toISOString() });
  if (agentId) qs.set('agentId', agentId);
  // previous period of the same length → trends on KPI cards
  const len = Math.max(DAY, toDate.getTime() - fromDate.getTime());
  const prevQs = new URLSearchParams({ from: new Date(fromDate.getTime() - len).toISOString(), to: fromDate.toISOString() });
  if (agentId) prevQs.set('agentId', agentId);
  const { data } = useApi<KpiReport>(`/crm/analytics/kpi?${qs}`, { keepPreviousData: true });
  const { data: prev } = useApi<KpiReport>(`/crm/analytics/kpi?${prevQs}`, { keepPreviousData: true });
  const today = iso(new Date());
  const activePreset = to === today ? PRESETS.find((p) => iso(new Date(Date.now() - Number(p) * DAY)) === from) : undefined;
  const preset = (days: string) => {
    setFrom(iso(new Date(Date.now() - Number(days) * DAY)));
    setTo(iso(new Date()));
  };
  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('finance.view') ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/sources">
                <Target className="size-4" strokeWidth={2} aria-hidden /> {t('roiLink')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="card mb-5 flex flex-wrap items-end gap-x-4 gap-y-3 p-3 md:p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-muted">
            <CalendarRange className="size-4" strokeWidth={2} aria-hidden />
            {t('period')}
          </span>
          <ChipGroup label={t('period')} value={activePreset ?? ('' as (typeof PRESETS)[number])} onChange={preset} options={PRESETS.map((d) => ({ value: d, label: t(`ranges.${d}`) }))} />
        </div>
        <span aria-hidden className="hidden h-10 w-px bg-border md:block" />
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <Field label={t('from')}>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-40" />
          </Field>
          <Field label={t('to')}>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-40" />
          </Field>
        </div>
        {can('deals.viewAll') && (
          <Field label={t('agent')} className="min-w-52 flex-1 sm:flex-none">
            <MemberSelect value={agentId} onChange={setAgentId} placeholder={t('allAgents')} className="w-full sm:w-56" />
          </Field>
        )}
      </div>
      <KpiView data={data} prev={prev} />
    </div>
  );
}
