'use client';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CrmViewing } from '@lokacia/contracts';
import { Button, cn, EmptyState, IconButton, Skeleton } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { addDays, dayKey, dayLabel, monthLabel, startOfDay, startOfMonth, startOfWeek } from './dates';
import { RouteView } from './route-view';
import { SyncPanel } from './sync-panel';
import { ViewingDrawer } from './viewing-drawer';
import { ViewingFormDialog } from './viewing-form-dialog';
import { DayView, MonthView, WeekView } from './views';

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

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setCreating(true)}>
            {t('new')}
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={t('title')} className="flex rounded-button border border-border-strong bg-surface p-0.5">
              {VIEWS.map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-[5px] px-3 text-small', view === v ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text')}>
                  {t(`views.${v}`)}
                </button>
              ))}
            </div>
            {view !== 'route' && (
              <div className="flex items-center gap-1">
                <IconButton size="sm" label={t('prev')} onClick={() => step(-1)}>
                  <ChevronLeft className="size-4" strokeWidth={1.5} />
                </IconButton>
                <Button size="sm" variant="ghost" onClick={() => setCursor(startOfDay(new Date()))}>
                  {t('today')}
                </Button>
                <IconButton size="sm" label={t('next')} onClick={() => step(1)}>
                  <ChevronRight className="size-4" strokeWidth={1.5} />
                </IconButton>
                <span className="compact ml-1 text-h3 font-semibold tabular">{heading}</span>
              </div>
            )}
            {can('deals.viewAll') && (
              <div className="w-full sm:ml-auto sm:w-48">
                <MemberSelect value={agentId} onChange={setAgentId} placeholder={t('allAgents')} />
              </div>
            )}
          </div>

          {view === 'route' ? (
            <RouteView date={dayKey(cursor)} onDate={(d) => setCursor(new Date(`${d}T12:00:00`))} agentId={agentId} onOpen={(v) => setOpenId(v.id)} />
          ) : isLoading && !data ? (
            <Skeleton className="h-96" />
          ) : view === 'month' ? (
            <MonthView cursor={cursor} items={data ?? []} onOpen={(v) => setOpenId(v.id)} onDay={(d) => { setCursor(d); setView('day'); }} />
          ) : view === 'week' ? (
            <WeekView cursor={cursor} items={data ?? []} onOpen={(v) => setOpenId(v.id)} onDay={(d) => { setCursor(d); setView('day'); }} />
          ) : data?.length ? (
            <DayView items={data} onOpen={(v) => setOpenId(v.id)} />
          ) : (
            <EmptyState
              icon={<CalendarDays className="size-5" strokeWidth={1.5} aria-hidden />}
              title={t('empty')}
              description={t('emptyHint')}
              action={
                <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}>
                  {t('new')}
                </Button>
              }
            />
          )}
        </div>
        <aside className="flex flex-col gap-3">
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
