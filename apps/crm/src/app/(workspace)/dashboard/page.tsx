'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Activity, AlarmClock, ArrowRight, CalendarCheck2, CalendarDays, ChartLine, Check, CircleCheckBig, Clock, ListTodo, MapPin, Plus, Sparkles, SquareKanban, Trophy } from 'lucide-react';
import { formatMoney, type CrmTask, type CrmTaskCounts, type CrmViewing, type KpiReport } from '@lokacia/contracts';
import { Button, cn, Skeleton, useToast } from '@lokacia/ui';
import { useDateFormat } from '@/components/analytics/format';
import { KpiTiles, MonthlyCard, pct, PipelineSummary, stageTone } from '@/components/analytics/kpi-view';
import { PageHeader } from '@/components/common/page-header';
import { EmptyHint, PersonAvatar, Pill, Progress, SectionCard, StatCard, type Tone } from '@/components/common/ui';
import type { Board } from '@/components/deals/types';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

const DAY = 86_400_000;

/** C20 dashboard: greeting, KPIs with trends, pipeline summary, today's agenda, recent activity, monthly results and top agents. */
export default function DashboardPage() {
  const t = useTranslations('analytics');
  const d = useTranslations('analytics.dashboard');
  const nav = useTranslations('shell.nav');
  const fmt = useDateFormat();
  const { org, user, can } = useCrm();
  const analytics = can('analytics.view');
  const [range] = React.useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY);
    return { from: from.toISOString(), to: to.toISOString(), prevFrom: new Date(from.getTime() - 30 * DAY).toISOString() };
  });
  // Greeting and date depend on the viewer's clock: computed after mount to keep SSR markup stable.
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);
  const { data } = useApi<KpiReport>(analytics ? `/crm/analytics/kpi?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : null);
  const { data: prev } = useApi<KpiReport>(analytics ? `/crm/analytics/kpi?from=${encodeURIComponent(range.prevFrom)}&to=${encodeURIComponent(range.from)}` : null);
  const { data: counts } = useApi<CrmTaskCounts>('/crm/tasks/counts?scope=mine');

  const first = (user.name ?? '').split(' ')[0] ?? '';
  const hour = now?.getHours() ?? 12;
  const greeting = now ? d(hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening', { name: first }) : t('dashboardTitle');
  const today = now ? fmt.dayLine(now) : '';

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        className="mb-1"
        icon={Sparkles}
        title={greeting}
        subtitle={[today, org.name, t('ranges.30')].filter(Boolean).join(' · ')}
        actions={
          <>
            {analytics && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/analytics">
                  <ChartLine className="size-4" strokeWidth={2} aria-hidden /> {t('openAnalytics')}
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/deals?new=1">
                <Plus className="size-4" strokeWidth={2.4} aria-hidden /> {nav('deals')}
              </Link>
            </Button>
          </>
        }
      />

      {analytics ? (
        data ? (
          <>
            {(data.scope === 'own' || data.financeHidden) && <p className="text-small text-muted">{data.scope === 'own' ? t('scopeOwn') : t('financeHidden')}</p>}
            <KpiTiles data={data} prev={prev} keys={data.financeHidden ? ['openDeals', 'wonCount', 'winRate', 'newContacts'] : ['openDeals', 'pipelineValue', 'wonCommission', 'winRate']} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-card" />
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatCard href="/tasks?view=today" label={d('tasksToday')} value={counts?.today ?? '—'} icon={ListTodo} tone={4} />
          <StatCard href="/tasks?view=overdue" label={t('tiles.tasksOverdue')} value={counts?.overdue ?? '—'} icon={AlarmClock} tone="danger" />
          <StatCard href="/tasks?view=upcoming" label={d('tasksUpcoming')} value={counts?.upcoming ?? '—'} icon={Clock} tone={2} />
          <StatCard href="/tasks?view=done" label={d('tasksDone')} value={counts?.done ?? '—'} icon={CircleCheckBig} tone="success" />
        </div>
      )}

      {analytics && data && (
        <PipelineSummary
          data={data}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/deals">
                {d('openBoard')} <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Agenda counts={counts} />
        <RecentActivity />
      </div>

      {analytics && data && (
        <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <MonthlyCard data={data} />
          <TopAgents data={data} />
        </div>
      )}
    </div>
  );
}

type AgendaItem = { kind: 'viewing'; at: string; v: CrmViewing } | { kind: 'task'; at: string | null; task: CrmTask; overdue: boolean };

function Agenda({ counts }: { counts: CrmTaskCounts | undefined }) {
  const d = useTranslations('analytics.dashboard');
  const fmt = useDateFormat();
  const toast = useToast();
  const mutateApi = useApiMutation();
  const [day] = React.useState(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return { from: s.toISOString(), to: new Date(s.getTime() + DAY).toISOString() };
  });
  const { data: today, mutate: reloadToday } = useApi<CrmTask[]>('/crm/tasks?view=today&scope=mine');
  const { data: overdue, mutate: reloadOverdue } = useApi<CrmTask[]>('/crm/tasks?view=overdue&scope=mine');
  const { data: viewings } = useApi<CrmViewing[]>(`/crm/viewings?from=${encodeURIComponent(day.from)}&to=${encodeURIComponent(day.to)}`);
  const [busy, setBusy] = React.useState<string | null>(null);

  const loading = !today || !overdue || !viewings;
  const items: AgendaItem[] = loading
    ? []
    : [
        ...overdue.map((task) => ({ kind: 'task' as const, at: task.dueAt, task, overdue: true })),
        ...[...viewings.filter((v) => v.status !== 'cancelled').map((v) => ({ kind: 'viewing' as const, at: v.startsAt, v })), ...today.filter((x) => !overdue.some((o) => o.id === x.id)).map((task) => ({ kind: 'task' as const, at: task.dueAt, task, overdue: false }))].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '')),
      ];

  const complete = async (task: CrmTask) => {
    setBusy(task.id);
    try {
      await mutateApi(`/crm/tasks/${task.id}/complete`);
      toast({ title: d('taskDone'), tone: 'success' });
      await Promise.all([reloadToday(), reloadOverdue()]);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      icon={CalendarCheck2}
      tone={4}
      title={d('agenda')}
      description={d('agendaHint', { tasks: counts?.today ?? 0, viewings: viewings?.length ?? 0 })}
      action={
        <div className="flex items-center gap-1">
          {!!counts?.overdue && (
            <Link href="/tasks?view=overdue" className="rounded-full focus-visible:shadow-ring focus-visible:outline-none">
              <Pill tone="danger" dot size="sm">
                {d('overdueCount', { count: counts.overdue })}
              </Pill>
            </Link>
          )}
        </div>
      }
      bodyClassName="px-2 pb-3 pt-3 md:px-3"
    >
      {loading ? (
        <div className="flex flex-col gap-2 px-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyHint icon={CalendarCheck2} title={d('agendaEmpty')} description={d('agendaEmptyHint')} action={<Button asChild size="sm" variant="secondary"><Link href="/calendar?new=1">{d('planViewing')}</Link></Button>} />
      ) : (
        <ol className="flex max-h-[440px] flex-col gap-1 overflow-y-auto scrollbar-thin">
          {items.map((it) =>
            it.kind === 'viewing' ? (
              <li key={`v-${it.v.id}`}>
                <Link href={`/calendar?view=day&viewing=${it.v.id}`} className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular">{fmt.time(it.v.startsAt)}</span>
                  <span aria-hidden className="h-10 w-1 shrink-0 rounded-full bg-tone-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{it.v.title}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                      {it.v.contactName && <span className="truncate">{it.v.contactName}</span>}
                      {it.v.address && (
                        <>
                          <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span className="truncate">{it.v.address}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <Pill tone={6} icon={CalendarDays} size="sm" className="hidden sm:inline-flex">
                    {d('viewing')}
                  </Pill>
                </Link>
              </li>
            ) : (
              <li key={`t-${it.task.id}`} className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
                <span className={cn('w-12 shrink-0 text-right text-[13px] font-semibold tabular', it.overdue && 'text-danger')}>{it.task.dueAt ? (it.overdue ? fmt.shortDate(it.task.dueAt) : fmt.time(it.task.dueAt)) : '—'}</span>
                <button
                  type="button"
                  onClick={() => complete(it.task)}
                  disabled={busy === it.task.id}
                  aria-label={d('complete', { title: it.task.title })}
                  className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all hover:border-success hover:bg-success/10 focus-visible:shadow-ring focus-visible:outline-none disabled:opacity-50', it.overdue ? 'border-danger/50' : 'border-border-strong')}
                >
                  <Check className="size-3.5 text-success opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={3} aria-hidden />
                </button>
                <span className="min-w-0 flex-1">
                  <Link href={it.task.dealId ? `/deals/${it.task.dealId}` : it.task.contactId ? `/contacts/${it.task.contactId}` : '/tasks'} className="block truncate font-semibold hover:underline">
                    {it.task.title}
                  </Link>
                  <span className="block truncate text-[13px] text-muted">{[it.task.contactName, it.task.dealTitle].filter(Boolean).join(' · ') || d('task')}</span>
                </span>
                {it.overdue ? (
                  <Pill tone="danger" size="sm" icon={AlarmClock} className="hidden sm:inline-flex">
                    {d('overdue')}
                  </Pill>
                ) : it.task.priority === 'high' ? (
                  <Pill tone={7} size="sm" dot className="hidden sm:inline-flex">
                    {d('high')}
                  </Pill>
                ) : (
                  <Pill tone={4} size="sm" icon={ListTodo} className="hidden sm:inline-flex">
                    {d('task')}
                  </Pill>
                )}
              </li>
            ),
          )}
        </ol>
      )}
    </SectionCard>
  );
}

function RecentActivity() {
  const d = useTranslations('analytics.dashboard');
  const { rel } = useDateFormat();
  const { workspace } = useCrm();
  const { data, error } = useApi<Board>('/crm/deals');
  const stages = data?.pipeline.stages ?? workspace?.pipeline?.stages ?? [];
  const toneOf = (key: string): Tone => {
    const st = stages.find((s) => s.key === key);
    if (!st) return 'neutral';
    return stageTone(st.kind, stages.filter((s) => s.kind === 'open').findIndex((s) => s.key === key));
  };
  const recent = (data?.deals ?? []).slice().sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt)).slice(0, 7);
  return (
    <SectionCard
      icon={Activity}
      tone={5}
      title={d('activity')}
      description={d('activityHint')}
      action={
        <Link href="/deals" className="text-[13.5px] font-semibold text-link hover:underline">
          {d('all')}
        </Link>
      }
      bodyClassName="px-2 pb-3 pt-3 md:px-3"
    >
      {error ? (
        <EmptyHint icon={Activity} title={d('activityEmpty')} />
      ) : !data ? (
        <div className="flex flex-col gap-2 px-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyHint icon={SquareKanban} title={d('activityEmpty')} />
      ) : (
        <ol className="relative flex flex-col">
          {recent.map((deal, i) => {
            const isNew = Math.abs(new Date(deal.stageChangedAt).getTime() - new Date(deal.createdAt).getTime()) < 60_000;
            const stageName = stages.find((s) => s.key === deal.stage)?.name ?? deal.stage;
            return (
              <li key={deal.id} className="relative">
                {i < recent.length - 1 && <span aria-hidden className="absolute bottom-0 left-[26px] top-12 w-px bg-border" />}
                <Link href={`/deals/${deal.id}`} className="flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
                  <PersonAvatar name={deal.agentName ?? deal.contactName} size={34} ring />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-5 text-muted">
                      <span className="font-semibold text-text">{deal.agentName ?? d('someone')}</span> {isNew ? d('created') : d('moved')}
                    </span>
                    <span className="block truncate font-semibold leading-6">{deal.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Pill tone={toneOf(deal.stage)} dot size="sm">
                        {stageName}
                      </Pill>
                      {data.financeVisible && deal.valueMinor != null && deal.valueMinor > 0 && <span className="text-[12.5px] font-semibold text-muted tabular">{formatMoney(deal.valueMinor)}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-muted">{rel(deal.stageChangedAt)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

function TopAgents({ data }: { data: KpiReport }) {
  const t = useTranslations('analytics');
  const d = useTranslations('analytics.dashboard');
  const rows = data.ranking.slice(0, 5);
  const maxWon = Math.max(1, ...rows.map((r) => r.wonCount + r.openDeals));
  const medal: Record<number, string> = { 0: 'tone-accent', 1: 'tone-8', 2: 'tone-7' };
  return (
    <SectionCard
      icon={Trophy}
      tone={3}
      title={t('ranking')}
      description={d('topAgentsHint')}
      action={
        <Link href="/analytics" className="text-[13.5px] font-semibold text-link hover:underline">
          {d('all')}
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyHint icon={Trophy} title={t('noData')} />
      ) : (
        <ol className="flex flex-col gap-3.5">
          {rows.map((r, i) => (
            <li key={r.agentId} className="flex items-center gap-3">
              <span className="relative">
                <PersonAvatar name={r.name} size={38} />
                {i < 3 && <span className={cn('absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full bg-tone text-[10px] font-bold text-white ring-2 ring-surface', medal[i])}>{i + 1}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{r.name ?? '—'}</span>
                  <span className="shrink-0 text-[13px] font-semibold tabular">{data.financeHidden || r.wonCommissionMinor == null ? t('wonShort', { count: r.wonCount }) : formatMoney(r.wonCommissionMinor)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <Progress value={((r.wonCount + r.openDeals) / maxWon) * 100} tone={i === 0 ? 1 : 2} label={r.name ?? ''} />
                  <span className="w-24 shrink-0 text-right text-[12px] text-muted tabular">
                    {t('openShort', { count: r.openDeals })} · {pct(r.conversionPct)}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

