'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Clock3, MapPin } from 'lucide-react';
import type { CrmViewing } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { PersonAvatar, Pill } from '@/components/common/ui';
import { addDays, dayKey, dayLabel, startOfMonth, startOfWeek, timeHM, WEEKDAYS_SHORT_KA } from './dates';

function byDay(items: CrmViewing[]) {
  const m = new Map<string, CrmViewing[]>();
  for (const v of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = dayKey(new Date(v.startsAt));
    m.set(k, [...(m.get(k) ?? []), v]);
  }
  return m;
}

/** Event colour by status: planned = blue, done = green, cancelled = slate (struck through). */
export const STATUS_CLASS = {
  planned: 'tone-2',
  done: 'tone-success',
  cancelled: 'tone-8',
} as const;

const shortTitle = (v: CrmViewing) => v.title.replace(/^ჩვენება:\s*/, '');

function Chip({ v, onOpen }: { v: CrmViewing; onOpen: (v: CrmViewing) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(v);
      }}
      className={cn(
        'group/chip flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-tone-soft px-1.5 py-1 text-left text-[12px] font-medium leading-4 text-tone-ink transition-all duration-150 hover:brightness-95 hover:shadow-xs focus-visible:shadow-ring focus-visible:outline-none',
        STATUS_CLASS[v.status],
        v.status === 'cancelled' && 'line-through opacity-70',
      )}
      title={`${timeHM(v.startsAt)} ${v.title}`}
    >
      <span aria-hidden className="h-3.5 w-[3px] shrink-0 rounded-full bg-tone" />
      <span className="shrink-0 tabular opacity-80">{timeHM(v.startsAt)}</span>
      <span className="truncate">{shortTitle(v)}</span>
    </button>
  );
}

export function MonthView({ cursor, items, onOpen, onDay }: { cursor: Date; items: CrmViewing[]; onOpen: (v: CrmViewing) => void; onDay: (d: Date) => void }) {
  const t = useTranslations('calendar');
  const map = byDay(items);
  const first = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const today = dayKey(new Date());
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center text-[12px] font-semibold uppercase tracking-wide text-muted">
        {WEEKDAYS_SHORT_KA.map((w, i) => (
          <div key={w} className={cn('py-2.5', i >= 5 && 'text-muted/70')}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const k = dayKey(d);
          const list = map.get(k) ?? [];
          const other = d.getMonth() !== cursor.getMonth();
          const isToday = k === today;
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              onClick={() => onDay(d)}
              onKeyDown={(e) => e.key === 'Enter' && onDay(d)}
              aria-label={`${dayLabel(d)}: ${list.length}`}
              className={cn(
                'group flex min-h-[68px] flex-col gap-1 border-border p-1.5 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-primary-soft/40 focus-visible:outline-none md:min-h-[118px]',
                (i + 1) % 7 !== 0 && 'border-r',
                i < 35 && 'border-b',
                other && 'bg-surface-2/35',
                isToday && 'bg-primary-soft/35',
              )}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center self-center rounded-full text-[13px] font-semibold tabular md:self-start',
                  isToday ? 'bg-primary text-primary-contrast shadow-sm' : other ? 'text-muted/60' : 'text-text group-hover:bg-surface',
                )}
              >
                {d.getDate()}
              </span>
              <div className="hidden flex-col gap-1 md:flex">
                {list.slice(0, 3).map((v) => (
                  <Chip key={v.id} v={v} onOpen={onOpen} />
                ))}
                {list.length > 3 && <span className="px-1.5 text-[11.5px] font-semibold text-muted">{t('more', { count: list.length - 3 })}</span>}
              </div>
              {list.length > 0 && (
                <span className="flex justify-center gap-0.5 md:hidden" aria-hidden>
                  {list.slice(0, 4).map((v) => (
                    <span key={v.id} className={cn('size-1.5 rounded-full bg-tone', STATUS_CLASS[v.status])} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HOUR_PX = 56;

function hoursRange(items: CrmViewing[]) {
  let min = 9;
  let max = 19;
  for (const v of items) {
    const s = new Date(v.startsAt);
    const e = new Date(v.endsAt);
    min = Math.min(min, s.getHours());
    max = Math.max(max, e.getHours() + (e.getMinutes() ? 1 : 0));
  }
  return [Math.max(0, min), Math.min(24, Math.max(max, min + 1))] as const;
}

/** Assigns overlapping events to side-by-side lanes; each overlap cluster gets its own lane count. */
function lanes(list: CrmViewing[]) {
  const out: { v: CrmViewing; lane: number; count: number }[] = [];
  let cluster: { v: CrmViewing; lane: number; count: number }[] = [];
  let ends: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const c of cluster) c.count = Math.max(1, ends.length);
    out.push(...cluster);
    cluster = [];
    ends = [];
  };
  for (const v of list) {
    const s = new Date(v.startsAt).getTime();
    const e = new Date(v.endsAt).getTime();
    if (s >= clusterEnd) flush();
    let lane = ends.findIndex((x) => x <= s);
    if (lane < 0) lane = ends.length;
    ends[lane] = e;
    clusterEnd = Math.max(s >= clusterEnd ? -Infinity : clusterEnd, e);
    cluster.push({ v, lane, count: 1 });
  }
  flush();
  return out;
}

function useNowMinutes() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TimeGrid({ days, items, onOpen, onDay, wide }: { days: Date[]; items: CrmViewing[]; onOpen: (v: CrmViewing) => void; onDay?: (d: Date) => void; wide?: boolean }) {
  const t = useTranslations('calendar');
  const map = byDay(items);
  const [h0, h1] = hoursRange(items);
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const today = dayKey(new Date());
  const now = useNowMinutes();
  const nowTop = now ? ((now.getHours() - h0) * 60 + now.getMinutes()) * (HOUR_PX / 60) : -1;
  return (
    <div className="card overflow-hidden">
      <div className="grid border-b border-border bg-surface-2/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => {
          const k = dayKey(d);
          const isToday = k === today;
          const count = map.get(k)?.length ?? 0;
          return (
            <button key={k} type="button" disabled={!onDay} onClick={() => onDay?.(d)} className={cn('flex items-center justify-center gap-2 border-l border-border px-2 py-2.5 text-[13px] transition-colors enabled:hover:bg-surface', wide && 'justify-start px-4')}>
              <span className="font-semibold uppercase tracking-wide text-muted">{WEEKDAYS_SHORT_KA[(d.getDay() + 6) % 7]}</span>
              <span className={cn('grid size-7 place-items-center rounded-full text-[14px] font-bold tabular', isToday ? 'bg-primary text-primary-contrast shadow-sm' : 'text-text')}>{d.getDate()}</span>
              {wide && count > 0 && <Pill tone={2} size="sm">{t('countViewings', { count })}</Pill>}
            </button>
          );
        })}
      </div>
      <div className="scrollbar-thin relative max-h-[640px] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`, height: hours.length * HOUR_PX }}>
          <div className="relative">
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11.5px] font-medium text-muted tabular" style={{ top: i * HOUR_PX }}>
                {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const k = dayKey(d);
            const out = lanes(map.get(k) ?? []);
            const isToday = k === today;
            return (
              <div key={k} className={cn('relative border-l border-border', isToday && 'bg-primary-soft/25')}>
                {hours.map((h, i) => (
                  <div key={h} aria-hidden className="absolute inset-x-0 border-t border-dashed border-border/80" style={{ top: i * HOUR_PX }} />
                ))}
                {isToday && nowTop > 0 && nowTop < hours.length * HOUR_PX && (
                  <div aria-hidden className="absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: nowTop }}>
                    <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-danger" />
                  </div>
                )}
                {out.map(({ v, lane, count }) => {
                  const s = new Date(v.startsAt);
                  const e = new Date(v.endsAt);
                  const top = ((s.getHours() - h0) * 60 + s.getMinutes()) * (HOUR_PX / 60);
                  const height = Math.max(26, ((e.getTime() - s.getTime()) / 60000) * (HOUR_PX / 60) - 3);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onOpen(v)}
                      title={`${timeHM(v.startsAt)}–${timeHM(v.endsAt)} ${v.title}`}
                      className={cn(
                        'absolute z-[5] flex flex-col overflow-hidden rounded-lg border-l-[3px] border-tone bg-tone-soft px-2 py-1 text-left text-tone-ink shadow-xs backdrop-blur-sm transition-all duration-150 hover:z-20 hover:shadow-md focus-visible:shadow-ring focus-visible:outline-none',
                        STATUS_CLASS[v.status],
                        v.status === 'cancelled' && 'opacity-70',
                      )}
                      style={{ top: top + 1, height, left: `calc(${(lane / count) * 100}% + 3px)`, width: `calc(${100 / count}% - 6px)` }}
                    >
                      <span className={cn('truncate text-[12.5px] font-semibold leading-4', v.status === 'cancelled' && 'line-through')}>{shortTitle(v)}</span>
                      {height > 34 && (
                        <span className="truncate text-[11.5px] leading-4 opacity-80 tabular">
                          {timeHM(v.startsAt)}–{timeHM(v.endsAt)}
                          {wide && v.contactName ? ` · ${v.contactName}` : ''}
                        </span>
                      )}
                      {wide && height > 60 && v.address && (
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] leading-4 opacity-80">
                          <MapPin className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                          {v.address}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WeekView({ cursor, items, onOpen, onDay }: { cursor: Date; items: CrmViewing[]; onOpen: (v: CrmViewing) => void; onDay: (d: Date) => void }) {
  const map = byDay(items);
  const first = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const today = dayKey(new Date());
  return (
    <>
      <div className="hidden md:block">
        <TimeGrid days={days} items={items} onOpen={onOpen} onDay={onDay} />
      </div>
      <div className="flex flex-col gap-2.5 md:hidden">
        {days.map((d, i) => {
          const k = dayKey(d);
          const list = map.get(k) ?? [];
          return (
            <section key={k} className={cn('card flex flex-col gap-1.5 p-3', k === today && 'ring-2 ring-primary/40')}>
              <button type="button" onClick={() => onDay(d)} className="flex items-center gap-2 text-left text-small">
                <span className={cn('grid size-8 place-items-center rounded-full text-[13px] font-bold tabular', k === today ? 'bg-primary text-primary-contrast' : 'bg-surface-2')}>{d.getDate()}</span>
                <span className="font-semibold">{WEEKDAYS_SHORT_KA[i]}</span>
                <span className="text-muted">{dayLabel(d)}</span>
              </button>
              {list.map((v) => (
                <Chip key={v.id} v={v} onOpen={onOpen} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

export function DayView({ items, onOpen, cursor }: { items: CrmViewing[]; onOpen: (v: CrmViewing) => void; cursor?: Date }) {
  const t = useTranslations('calendar');
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const day = cursor ?? (items[0] ? new Date(items[0].startsAt) : new Date());
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="hidden md:block">
        <TimeGrid days={[day]} items={items} onOpen={onOpen} wide />
      </div>
      <ol className="flex flex-col gap-2.5">
        {sorted.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onOpen(v)}
              className={cn('card card-hover flex w-full items-stretch gap-3 overflow-hidden p-0 text-left focus-visible:shadow-ring focus-visible:outline-none', STATUS_CLASS[v.status])}
            >
              <span aria-hidden className="w-1 shrink-0 bg-tone" />
              <span className="flex w-14 shrink-0 flex-col justify-center py-3 tabular">
                <span className="text-[15px] font-bold leading-5">{timeHM(v.startsAt)}</span>
                <span className="text-[12px] text-muted">{timeHM(v.endsAt)}</span>
              </span>
              <span className="min-w-0 flex-1 py-3">
                <span className={cn('block truncate font-semibold', v.status === 'cancelled' && 'line-through')}>{v.title}</span>
                {v.contactName && <span className="block truncate text-small text-muted">{v.contactName}</span>}
                {v.address && (
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
                    <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="truncate">{v.address}</span>
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end justify-between gap-2 py-3 pr-3">
                <Pill tone={STATUS_TONE_PILL[v.status]} dot size="sm">
                  {t(`status.${v.status}`)}
                </Pill>
                {v.agentName && (
                  <span title={v.agentName}>
                    <PersonAvatar name={v.agentName} size={24} />
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const STATUS_TONE_PILL = { planned: 2, done: 'success', cancelled: 'neutral' } as const;

/** Upcoming agenda (side panel). */
export function Agenda({ items, onOpen }: { items: CrmViewing[]; onOpen: (v: CrmViewing) => void }) {
  const t = useTranslations('calendar');
  const now = useNowMinutes();
  if (!now) return null;
  const upcoming = items
    .filter((v) => v.status === 'planned' && new Date(v.endsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);
  return (
    <section className="card p-4" aria-labelledby="cal-agenda">
      <h2 id="cal-agenda" className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid size-8 place-items-center rounded-[10px] bg-primary-soft text-primary-soft-text" aria-hidden>
          <Clock3 className="size-4" strokeWidth={2} />
        </span>
        {t('agenda.title')}
      </h2>
      {upcoming.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-small text-muted">{t('agenda.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {upcoming.map((v) => {
            const d = new Date(v.startsAt);
            return (
              <li key={v.id}>
                <button type="button" onClick={() => onOpen(v)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2">
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-[10px] bg-tone-soft py-1 text-tone-ink tone-2">
                    <span className="text-[16px] font-bold leading-5 tabular">{d.getDate()}</span>
                    <span className="text-[10.5px] font-semibold uppercase">{WEEKDAYS_SHORT_KA[(d.getDay() + 6) % 7]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{shortTitle(v)}</span>
                    <span className="block truncate text-[12.5px] text-muted tabular">
                      {timeHM(v.startsAt)}
                      {v.contactName ? ` · ${v.contactName}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
