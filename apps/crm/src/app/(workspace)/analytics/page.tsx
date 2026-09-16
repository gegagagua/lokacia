'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { KpiReport } from '@lokacia/contracts';
import { Field, Input, Select } from '@lokacia/ui';
import { KpiView } from '@/components/analytics/kpi-view';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { RequirePerm } from '@/components/common/require-perm';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

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
  const qs = new URLSearchParams({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() });
  if (agentId) qs.set('agentId', agentId);
  const { data } = useApi<KpiReport>(`/crm/analytics/kpi?${qs}`, { keepPreviousData: true });
  const preset = (days: string) => {
    setFrom(iso(new Date(Date.now() - Number(days) * DAY)));
    setTo(iso(new Date()));
  };
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={can('finance.view') ? <Link href="/sources" className="text-small text-link underline-offset-4 hover:underline">{t('roiLink')}</Link> : undefined} />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3">
        <Field label={t('period')}>
          <Select value="" placeholder="—" onChange={(e) => e.target.value && preset(e.target.value)} options={(['30', '90', '180', '365'] as const).map((d) => ({ value: d, label: t(`ranges.${d}`) }))} className="w-36" />
        </Field>
        <Field label={t('from')}>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </Field>
        <Field label={t('to')}>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </Field>
        {can('deals.viewAll') && (
          <Field label={t('agent')}>
            <MemberSelect value={agentId} onChange={setAgentId} placeholder={t('allAgents')} className="w-56" />
          </Field>
        )}
      </div>
      <KpiView data={data} />
    </div>
  );
}
