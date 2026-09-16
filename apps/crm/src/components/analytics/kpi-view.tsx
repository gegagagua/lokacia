'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { MONTHS_KA, formatMoney, type KpiReport } from '@lokacia/contracts';
import { Card, Skeleton, Stat, Table } from '@lokacia/ui';
import { ColumnChart, HBarChart } from './charts';

const pct = (n: number) => `${String(n).replace('.', ',')}%`;

/** KPI tiles + stage funnel + monthly won + agent ranking (C20). Shared by /dashboard and /analytics. */
export function KpiView({ data, compact }: { data: KpiReport | undefined; compact?: boolean }) {
  const t = useTranslations('analytics');
  if (!data) return <Skeleton className="h-96" />;
  const tt = data.totals;
  const money = (v: number | null) => (v == null ? '—' : formatMoney(v));
  const tiles = [
    { key: 'openDeals', value: tt.openDeals },
    ...(data.financeHidden ? [] : [{ key: 'pipelineValue', value: money(tt.pipelineValueMinor) }]),
    { key: 'wonCount', value: tt.wonCount },
    ...(data.financeHidden ? [] : [{ key: 'wonCommission', value: money(tt.wonCommissionMinor) }]),
    { key: 'winRate', value: pct(tt.winRatePct), hint: t('tiles.winRateHint') },
    { key: 'leadToWon', value: pct(tt.leadToWonPct) },
    { key: 'avgCycle', value: tt.avgCycleDays == null ? '—' : t('tiles.avgCycleValue', { days: String(tt.avgCycleDays).replace('.', ',') }) },
    { key: 'newContacts', value: tt.newContacts },
    ...(compact ? [] : [{ key: 'newDeals', value: tt.newDeals }, { key: 'viewings', value: tt.viewings }, { key: 'tasksOverdue', value: tt.tasksOverdue }, ...(data.financeHidden ? [] : [{ key: 'wonValue', value: money(tt.wonValueMinor) }])]),
  ];
  const monthLabel = (m: string) => `${MONTHS_KA[Number(m.slice(5, 7)) - 1]!.slice(0, 3)} ${m.slice(2, 4)}`;
  return (
    <div className="flex flex-col gap-4">
      {data.scope === 'own' && <p className="text-small text-muted">{t('scopeOwn')}</p>}
      {data.financeHidden && <p className="text-small text-muted">{t('financeHidden')}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <Stat key={x.key} label={t(`tiles.${x.key}`)} value={x.value} hint={'hint' in x ? x.hint : undefined} className="p-3 [&>div:nth-child(2)]:text-[24px] [&>div:nth-child(2)]:leading-8" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold">{t('funnel')}</h2>
          <p className="mb-3 text-small text-muted">{t('funnelHint')}</p>
          <HBarChart
            caption={t('funnel')}
            valueHeader={t('count')}
            data={data.byStage.map((s) => ({ key: s.key, label: s.name, value: s.count, display: `${s.count}${s.valueMinor != null && s.valueMinor > 0 ? ` · ${formatMoney(s.valueMinor)}` : ''}`, tone: s.kind === 'won' ? 'success' : s.kind === 'lost' ? 'danger' : 'primary' }))}
          />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">{t('monthly')}</h2>
          <ColumnChart
            caption={t('monthly')}
            data={data.monthly.map((m) => ({ key: m.month, label: monthLabel(m.month), value: data.financeHidden ? m.wonCount : (m.wonValueMinor ?? 0), display: data.financeHidden || !m.wonValueMinor ? String(m.wonCount) : formatMoney(m.wonValueMinor).replace(' ₾', '') }))}
          />
        </Card>
      </div>
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{t('ranking')}</h2>
        <Table
          className="border-0"
          rows={data.ranking.map((r, i) => ({ ...r, rank: i + 1 }))}
          rowKey={(r) => r.agentId}
          empty={t('noData')}
          columns={[
            { key: 'rank', header: t('rank'), cell: (r) => <span className="tabular text-muted">{r.rank}</span>, sortValue: (r) => r.rank },
            { key: 'name', header: t('agent'), cell: (r) => <span className="font-medium">{r.name ?? '—'}</span>, sortValue: (r) => r.name ?? '' },
            { key: 'won', header: t('won'), align: 'right', cell: (r) => r.wonCount, sortValue: (r) => r.wonCount },
            { key: 'lost', header: t('lost'), align: 'right', cell: (r) => r.lostCount, sortValue: (r) => r.lostCount },
            { key: 'conv', header: t('conversion'), align: 'right', cell: (r) => pct(r.conversionPct), sortValue: (r) => r.conversionPct },
            ...(data.financeHidden ? [] : [{ key: 'commission', header: t('commission'), align: 'right' as const, cell: (r: (typeof data.ranking)[number]) => money(r.wonCommissionMinor), sortValue: (r: (typeof data.ranking)[number]) => r.wonCommissionMinor ?? 0 }]),
            { key: 'open', header: t('open'), align: 'right', cell: (r) => r.openDeals, sortValue: (r) => r.openDeals },
          ]}
        />
      </Card>
    </div>
  );
}
