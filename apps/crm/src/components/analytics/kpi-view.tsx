'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlarmClock, Banknote, CalendarDays, Coins, FilePlus2, Filter, Layers, Medal, SquareKanban, Target, Timer, TrendingUp, Trophy, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react';
import { MONTHS_KA, formatMoney, type KpiReport } from '@lokacia/contracts';
import { cn, Skeleton, Table } from '@lokacia/ui';
import { EmptyHint, PersonAvatar, Pill, Progress, SectionCard, Segmented, StatCard, type Tone } from '@/components/common/ui';
import { AreaChart, ColumnChart, HBarChart, Ring, StackedBar, type BarDatum } from './charts';

export const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')}%`;
const OPEN_TONES: Tone[] = [2, 6, 4, 3, 7, 5, 1];

/** Colour of a pipeline stage: open stages cycle through the categorical palette, won = success, lost = danger. */
export function stageTone(kind: 'open' | 'won' | 'lost', openIndex: number): Tone {
  if (kind === 'won') return 'success';
  if (kind === 'lost') return 'danger';
  return OPEN_TONES[openIndex % OPEN_TONES.length]!;
}

export function stageData(data: KpiReport, withValue = true): BarDatum[] {
  let open = 0;
  return data.byStage.map((s) => {
    const tone = stageTone(s.kind, s.kind === 'open' ? open++ : 0);
    return {
      key: s.key,
      label: s.name,
      value: s.count,
      display: String(s.count),
      hint: withValue && s.valueMinor != null && s.valueMinor > 0 ? formatMoney(s.valueMinor) : undefined,
      tone,
    };
  });
}

type TileKey = keyof KpiReport['totals'];
const TILE_META: Record<string, { icon: LucideIcon; tone: Tone; lowerIsBetter?: boolean; state?: boolean }> = {
  openDeals: { icon: SquareKanban, tone: 2, state: true },
  pipelineValue: { icon: Wallet, tone: 1, state: true },
  wonCount: { icon: Trophy, tone: 'success' },
  wonCommission: { icon: Coins, tone: 3 },
  winRate: { icon: Target, tone: 4 },
  leadToWon: { icon: Filter, tone: 6 },
  avgCycle: { icon: Timer, tone: 7, lowerIsBetter: true },
  newContacts: { icon: UserPlus, tone: 5 },
  newDeals: { icon: FilePlus2, tone: 2 },
  viewings: { icon: CalendarDays, tone: 6 },
  tasksOverdue: { icon: AlarmClock, tone: 'danger', lowerIsBetter: true },
  wonValue: { icon: Banknote, tone: 1 },
};
const RAW: Record<string, TileKey> = {
  openDeals: 'openDeals',
  pipelineValue: 'pipelineValueMinor',
  wonCount: 'wonCount',
  wonCommission: 'wonCommissionMinor',
  winRate: 'winRatePct',
  leadToWon: 'leadToWonPct',
  avgCycle: 'avgCycleDays',
  newContacts: 'newContacts',
  newDeals: 'newDeals',
  viewings: 'viewings',
  tasksOverdue: 'tasksOverdue',
  wonValue: 'wonValueMinor',
};

function trendFor(key: string, cur: KpiReport, prev: KpiReport | undefined) {
  const meta = TILE_META[key];
  if (!prev || !meta || meta.state) return null;
  const a = cur.totals[RAW[key]!] as number | null;
  const b = prev.totals[RAW[key]!] as number | null;
  if (a == null || b == null) return null;
  const isPct = key === 'winRate' || key === 'leadToWon';
  let label: string;
  let diff: number;
  if (isPct) {
    diff = a - b;
    if (Math.abs(diff) < 0.05) return null;
    label = `${diff > 0 ? '+' : '−'}${String(Math.abs(Math.round(diff * 10) / 10)).replace('.', ',')} pp`;
  } else {
    if (b === 0) return null;
    diff = ((a - b) / b) * 100;
    if (Math.abs(diff) < 0.5) return null;
    label = `${diff > 0 ? '+' : '−'}${Math.abs(Math.round(diff))}%`;
  }
  const up = diff > 0;
  return { value: label, up, good: meta.lowerIsBetter ? !up : up };
}

/** KPI stat cards with icon tiles and period-over-period trend. */
export function KpiTiles({ data, prev, keys, className }: { data: KpiReport; prev?: KpiReport; keys?: string[]; className?: string }) {
  const t = useTranslations('analytics');
  const tt = data.totals;
  const money = (v: number | null) => (v == null ? '—' : <span className="whitespace-nowrap text-[22px] sm:text-[28px]">{formatMoney(v)}</span>);
  const all: { key: string; value: React.ReactNode; hint?: string; finance?: boolean }[] = [
    { key: 'openDeals', value: tt.openDeals },
    { key: 'pipelineValue', value: money(tt.pipelineValueMinor), finance: true },
    { key: 'wonCount', value: tt.wonCount },
    { key: 'wonCommission', value: money(tt.wonCommissionMinor), finance: true },
    { key: 'winRate', value: pct(tt.winRatePct), hint: t('tiles.winRateHint') },
    { key: 'leadToWon', value: pct(tt.leadToWonPct) },
    { key: 'avgCycle', value: tt.avgCycleDays == null ? '—' : t('tiles.avgCycleValue', { days: String(tt.avgCycleDays).replace('.', ',') }) },
    { key: 'newContacts', value: tt.newContacts },
    { key: 'newDeals', value: tt.newDeals },
    { key: 'viewings', value: tt.viewings },
    { key: 'tasksOverdue', value: tt.tasksOverdue },
    { key: 'wonValue', value: money(tt.wonValueMinor), finance: true },
  ];
  const tiles = all.filter((x) => !(x.finance && data.financeHidden)).filter((x) => !keys || keys.includes(x.key));
  const ordered = keys ? keys.map((k) => tiles.find((x) => x.key === k)).filter((x): x is (typeof tiles)[number] => !!x) : tiles;
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4', className)}>
      {ordered.map((x) => {
        const meta = TILE_META[x.key]!;
        return <StatCard key={x.key} label={<span className="[overflow-wrap:anywhere]">{t(`tiles.${x.key}`)}</span>} value={x.value} hint={x.hint} icon={meta.icon} tone={meta.tone} trend={trendFor(x.key, data, prev)} />;
      })}
    </div>
  );
}

/** Pipeline distribution: stacked bar + legend (counts and values per stage). */
export function PipelineSummary({ data, action, compactLegend }: { data: KpiReport; action?: React.ReactNode; compactLegend?: boolean }) {
  const t = useTranslations('analytics');
  const d = stageData(data, !data.financeHidden);
  const total = data.byStage.filter((s) => s.kind === 'open').reduce((s, x) => s + x.count, 0);
  return (
    <SectionCard
      icon={Layers}
      tone={2}
      title={t('pipeline.title')}
      description={t('pipeline.hint', { count: total })}
      action={action}
    >
      <StackedBar data={d} caption={t('pipeline.title')} className={compactLegend ? 'xl:[&_ul]:grid-cols-3' : undefined} />
    </SectionCard>
  );
}

export function FunnelCard({ data }: { data: KpiReport }) {
  const t = useTranslations('analytics');
  const d = stageData(data, !data.financeHidden).map((x) => ({ ...x, display: x.hint ? `${x.display} · ${x.hint}` : x.display }));
  return (
    <SectionCard icon={Filter} tone={6} title={t('funnel')} description={t('funnelHint')}>
      {d.length ? <HBarChart caption={t('funnel')} valueHeader={t('count')} data={d} /> : <EmptyHint icon={Filter} title={t('noData')} />}
    </SectionCard>
  );
}

export function MonthlyCard({ data }: { data: KpiReport }) {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const [mode, setMode] = React.useState<'value' | 'count'>(data.financeHidden ? 'count' : 'value');
  const monthLabel = (m: string) => {
    const idx = Number(m.slice(5, 7)) - 1;
    const short = locale === 'ka' ? MONTHS_KA[idx]!.slice(0, 3) : new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, idx, 1)).replace('.', '');
    return `${short} ${m.slice(2, 4)}`;
  };
  const series: BarDatum[] = data.monthly.map((m) =>
    mode === 'count' ? { key: m.month, label: monthLabel(m.month), value: m.wonCount, display: String(m.wonCount) } : { key: m.month, label: monthLabel(m.month), value: m.wonValueMinor ?? 0, display: m.wonValueMinor ? formatMoney(m.wonValueMinor).replace(' ₾', '') : '0' },
  );
  return (
    <SectionCard
      icon={TrendingUp}
      tone={1}
      title={t('monthly')}
      description={mode === 'value' ? t('monthlyValueHint') : t('monthlyCountHint')}
      action={
        !data.financeHidden && (
          <Segmented
            size="sm"
            label={t('monthly')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'value', label: t('value') },
              { value: 'count', label: t('count') },
            ]}
          />
        )
      }
    >
      {mode === 'value' ? <ColumnChart caption={t('monthly')} data={series} height={220} tone={1} /> : <AreaChart caption={t('monthly')} data={series} height={220} tone={2} />}
    </SectionCard>
  );
}

const MEDAL: Record<number, string> = { 1: 'tone-accent', 2: 'tone-8', 3: 'tone-7' };

export function RankingCard({ data }: { data: KpiReport }) {
  const t = useTranslations('analytics');
  const money = (v: number | null) => (v == null ? '—' : formatMoney(v));
  type Row = KpiReport['ranking'][number] & { rank: number };
  const rows: Row[] = data.ranking.map((r, i) => ({ ...r, rank: i + 1 }));
  return (
    <SectionCard icon={Medal} tone={3} title={t('ranking')} description={t('rankingHint')} bodyClassName="p-2 md:p-3">
      <Table
        className="border-0 shadow-none"
        rows={rows}
        rowKey={(r) => r.agentId}
        empty={t('noData')}
        columns={[
          {
            key: 'rank',
            header: t('rank'),
            sortValue: (r) => r.rank,
            cell: (r) =>
              r.rank <= 3 ? (
                <span className={cn('grid size-7 place-items-center rounded-full bg-tone-soft text-[12.5px] font-bold text-tone-ink tabular', MEDAL[r.rank])}>{r.rank}</span>
              ) : (
                <span className="grid size-7 place-items-center text-[13px] text-muted tabular">{r.rank}</span>
              ),
          },
          {
            key: 'name',
            header: t('agent'),
            sortValue: (r) => r.name ?? '',
            cell: (r) => (
              <span className="flex min-w-40 items-center gap-2.5">
                <PersonAvatar name={r.name} size={32} />
                <span className="truncate font-semibold">{r.name ?? '—'}</span>
                {r.rank === 1 && r.wonCount > 0 && <Trophy className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />}
              </span>
            ),
          },
          { key: 'won', header: t('won'), align: 'right', sortValue: (r) => r.wonCount, cell: (r) => <Pill size="sm" tone={r.wonCount ? 'success' : 'neutral'}>{r.wonCount}</Pill> },
          { key: 'lost', header: t('lost'), align: 'right', sortValue: (r) => r.lostCount, cell: (r) => <Pill size="sm" tone={r.lostCount ? 'danger' : 'neutral'}>{r.lostCount}</Pill> },
          {
            key: 'conv',
            header: t('conversion'),
            align: 'right',
            sortValue: (r) => r.conversionPct,
            cell: (r) => (
              <span className="ml-auto flex w-32 items-center gap-2">
                <Progress value={r.conversionPct} tone={r.conversionPct >= 50 ? 'success' : 2} label={t('conversion')} />
                <span className="w-11 shrink-0 text-right font-medium tabular">{pct(r.conversionPct)}</span>
              </span>
            ),
          },
          ...(data.financeHidden ? [] : [{ key: 'commission', header: t('commission'), align: 'right' as const, cell: (r: Row) => <span className="whitespace-nowrap font-semibold tabular">{money(r.wonCommissionMinor)}</span>, sortValue: (r: Row) => r.wonCommissionMinor ?? 0 }]),
          { key: 'open', header: t('open'), align: 'right', cell: (r) => <span className="tabular">{r.openDeals}</span>, sortValue: (r) => r.openDeals },
        ]}
      />
    </SectionCard>
  );
}

export function WinRateCard({ data }: { data: KpiReport }) {
  const t = useTranslations('analytics');
  const tt = data.totals;
  return (
    <SectionCard icon={Target} tone={4} title={t('tiles.winRate')} description={t('tiles.winRateHint')}>
      <div className="flex flex-wrap items-center gap-6">
        <Ring value={tt.winRatePct} size={132} stroke={12} tone={4} label={`${t('tiles.winRate')}: ${pct(tt.winRatePct)}`}>
          <span>
            <span className="block text-[26px] font-bold leading-7 tracking-tight tabular">{pct(tt.winRatePct)}</span>
          </span>
        </Ring>
        <dl className="grid min-w-40 flex-1 gap-3">
          {[
            { k: 'won', v: tt.wonCount, tone: 'success' as Tone },
            { k: 'lost', v: tt.lostCount, tone: 'danger' as Tone },
            { k: 'leadToWon', v: pct(tt.leadToWonPct), tone: 6 as Tone },
          ].map((x) => (
            <div key={x.k} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <dt className="flex items-center gap-2 text-[13.5px] text-muted">
                <span className={cn('size-2 rounded-full bg-tone', `tone-${x.tone}`)} aria-hidden />
                {x.k === 'leadToWon' ? t('tiles.leadToWon') : t(`${x.k}Full`)}
              </dt>
              <dd className="font-bold tabular">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionCard>
  );
}

export function KpiSkeleton({ tiles = 8 }: { tiles?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    </div>
  );
}

/** Full analytics layout (C20): tiles, pipeline, funnel/monthly, win rate, ranking. */
export function KpiView({ data, prev }: { data: KpiReport | undefined; prev?: KpiReport; compact?: boolean }) {
  const t = useTranslations('analytics');
  if (!data) return <KpiSkeleton tiles={12} />;
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {(data.scope === 'own' || data.financeHidden) && (
        <div className="flex flex-wrap gap-2">
          {data.scope === 'own' && <Pill icon={Users} tone={2}>{t('scopeOwn')}</Pill>}
          {data.financeHidden && <Pill tone="neutral">{t('financeHidden')}</Pill>}
        </div>
      )}
      <KpiTiles data={data} prev={prev} />
      {prev && <p className="-mt-1 text-[13px] text-muted">{t('trendHint')}</p>}
      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PipelineSummary data={data} compactLegend />
        <WinRateCard data={data} />
      </div>
      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <MonthlyCard data={data} />
        <FunnelCard data={data} />
      </div>
      <RankingCard data={data} />
    </div>
  );
}
