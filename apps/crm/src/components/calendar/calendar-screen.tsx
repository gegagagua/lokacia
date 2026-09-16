'use client';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3, LayoutGrid, Plus, Route, Square } from 'lucide-react';
import type { CrmViewing } from '@lokacia/contracts';
import { Button, EmptyState, Skeleton } from '@lokacia/ui';
import { Segmented } from '@/components/common/ui';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { addDays, dayKey, dayLabel, monthLabel, startOfDay, startOfMonth, startOfWeek } from './dates';
import { RouteView } from './route-view';
import { SyncPanel } from './sync-panel';
import { ViewingDrawer } from './viewing-drawer';
import { ViewingFormDialog } from './viewing-form-dialog';
import { Agenda, DayView, MonthView, WeekView } from './views';

type View = 'month' | 'week' | 'day' | 'route';
const VIEWS: View[] = ['month', 'week', 'day', 'route'];

export function CalendarScreen() {
  const t = useTranslations('calendar');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useCrm();
  const [view, setView] = React.useState<View>(() => (VIEWS.includes(params.get('view') as View) ? (params.get('view') as View) : 'month'));
  const [cursor, setCursor] = React.useState(() => (params.get('date') ? new Date(`${params.get('date')}T12:00:00`) : startOfDay(new Date())));
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(params.get('viewing'));
  const [creating, setCreating] = React.useState(params.get('new') === '1');

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable],[role=dialog]')) return;
      if (e.key === 'n') setCreating(true);
      else if (e.key === 'm') setView('month');
      else if (e.key === 'w') setView('week');
      else if (e.key === 'd') setView('day');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [from, to] = React.useMemo(() => {
    if (view === 'month') {
      const f = startOfWeek(startOfMonth(cursor));
      return [f, addDays(f, 42)];
    }
    if (view === 'week') {
      const f = startOfWeek(cursor);
      return [f, addDays(f, 7)];
    }
    const f = startOfDay(cursor);
    return [f, addDays(f, 1)];
  }, [view, cursor]);

  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (agentId) qs.set('agentId', agentId);
  const { data, isLoading, mutate } = useApi<CrmViewing[]>(view === 'route' ? null : `/crm/viewings?${qs}`);
  const { data: opened, mutate: reloadOpened } = useApi<CrmViewing>(openId ? `/crm/viewings/${openId}` : null);

  const step = (dir: 1 | -1) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else setCursor(addDays(cursor, (view === 'week' ? 7 : 1) * dir));
  };
  const heading = view === 'month' ? monthLabel(cursor) : view === 'week' ? `${dayLabel(startOfWeek(cursor))} — ${dayLabel(addDays(startOfWeek(cursor), 6))}` : `${dayLabel(cursor)}, ${cursor.getFullYear()}`;

  const clearNewParam = () => {
    if (params.get('new')) router.replace(pathname);
  };

  const viewIcons = { month: LayoutGrid, week: Columns3, day: Square, route: Route } as const;

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button icon={<Plus className="size-4" strokeWidth={2.2} aria-hidden />} onClick={() => setCreating(true)}>
            {t('new')}
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="card flex flex-wrap items-center gap-x-3 gap-y-2.5 p-2.5">
            <Segmented
              label={t('title')}
              value={view}
              onChange={setView}
              className="scrollbar-none max-w-full overflow-x-auto"
              options={VIEWS.map((v) => ({ value: v, label: t(`views.${v}`), icon: viewIcons[v] }))}
            />
            {view !== 'route' && (
              <div className="flex min-w-0 items-center gap-1">
                <button type="button" aria-label={t('prev')} title={t('prev')} onClick={() => step(-1)} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
                  <ChevronLeft className="size-[18px]" strokeWidth={2.2} aria-hidden />
                </button>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setCursor(startOfDay(new Date()))}>
                  {t('today')}
                </Button>
                <button type="button" aria-label={t('next')} title={t('next')} onClick={() => step(1)} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
                  <ChevronRight className="size-[18px]" strokeWidth={2.2} aria-hidden />
                </button>
                <h2 className="ml-2 truncate text-[18px] font-bold tracking-tight tabular md:text-[20px]" aria-live="polite">
                  {heading}
                </h2>
              </div>
            )}
            {can('deals.viewAll') && (
              <div className="w-full sm:ml-auto sm:w-52">
                <MemberSelect value={agentId} onChange={setAgentId} placeholder={t('allAgents')} className="h-10" />
              </div>
            )}
          </div>

          {view === 'route' ? (
            <RouteView date={dayKey(cursor)} onDate={(d) => setCursor(new Date(`${d}T12:00:00`))} agentId={agentId} onOpen={(v) => setOpenId(v.id)} />
          ) : isLoading && !data ? (
            <Skeleton className="h-[560px] rounded-card" />
          ) : view === 'month' ? (
            <MonthView cursor={cursor} items={data ?? []} onOpen={(v) => setOpenId(v.id)} onDay={(d) => { setCursor(d); setView('day'); }} />
          ) : view === 'week' ? (
            <WeekView cursor={cursor} items={data ?? []} onOpen={(v) => setOpenId(v.id)} onDay={(d) => { setCursor(d); setView('day'); }} />
          ) : data?.length ? (
            <DayView items={data} cursor={cursor} onOpen={(v) => setOpenId(v.id)} />
          ) : (
            <EmptyState
              icon={<CalendarDays className="size-6" strokeWidth={2} aria-hidden />}
              title={t('empty')}
              description={t('emptyHint')}
              action={
                <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" strokeWidth={2.2} aria-hidden />}>
                  {t('new')}
                </Button>
              }
            />
          )}
        </div>
        <aside className="flex flex-col gap-4">
          {view !== 'route' && data && <Agenda items={data} onOpen={(v) => setOpenId(v.id)} />}
          {view !== 'route' && data && <StatusLegend items={data} />}
          <SyncPanel onSynced={() => mutate()} />
        </aside>
      </div>

      <ViewingFormDialog
        open={creating}
        onOpenChange={(o) => {
          setCreating(o);
          if (!o) clearNewParam();
        }}
        prefill={{ dealId: params.get('dealId'), contactId: params.get('contactId'), listingId: params.get('listingId'), date: view === 'day' ? dayKey(cursor) : undefined }}
        onCreated={(v) => {
          setCursor(startOfDay(new Date(v.startsAt)));
          void mutate();
          clearNewParam();
        }}
      />
      <ViewingDrawer
        viewing={openId ? (opened ?? null) : null}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={() => {
          void mutate();
          void reloadOpened();
        }}
      />
    </div>
  );
}

function StatusLegend({ items }: { items: CrmViewing[] }) {
  const t = useTranslations('calendar');
  const counts = { planned: 0, done: 0, cancelled: 0 };
  for (const v of items) counts[v.status]++;
  const tones = { planned: 'tone-2', done: 'tone-success', cancelled: 'tone-8' } as const;
  return (
    <section className="card p-4" aria-labelledby="cal-legend">
      <h2 id="cal-legend" className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid size-8 place-items-center rounded-[10px] bg-surface-2 text-muted" aria-hidden>
          <CalendarRange className="size-4" strokeWidth={2} />
        </span>
        {t('legend')}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
          <li key={k} className={`rounded-xl bg-tone-faint p-2.5 ${tones[k]}`}>
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <span aria-hidden className="size-2 rounded-full bg-tone" />
              <span className="truncate">{t(`status.${k}`)}</span>
            </div>
            <div className="mt-0.5 text-[20px] font-bold tabular">{counts[k]}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
