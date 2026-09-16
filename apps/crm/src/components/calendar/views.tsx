'use client';
import { useTranslations } from 'next-intl';
import type { CrmViewing } from '@lokacia/contracts';
import { Badge, cn } from '@lokacia/ui';
import { addDays, dayKey, dayLabel, startOfMonth, startOfWeek, timeHM, WEEKDAYS_SHORT_KA } from './dates';
import { STATUS_TONE } from './viewing-drawer';

function byDay(items: CrmViewing[]) {
  const m = new Map<string, CrmViewing[]>();
  for (const v of items) {
    const k = dayKey(new Date(v.startsAt));
    m.set(k, [...(m.get(k) ?? []), v]);
  }
  return m;
}

function Chip({ v, onOpen }: { v: CrmViewing; onOpen: (v: CrmViewing) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(v);
      }}
      className={cn(
        'flex w-full min-w-0 items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-left text-[12px] leading-4 hover:border-focus',
        v.status === 'cancelled' ? 'border-border text-muted line-through' : v.status === 'done' ? 'border-success/40 bg-success/10' : 'border-primary/30 bg-primary/10',
      )}
      title={`${timeHM(v.startsAt)} ${v.title}`}
    >
      <span className="shrink-0 tabular text-muted">{timeHM(v.startsAt)}</span>
      <span className="truncate">{v.title.replace(/^ჩვენება:\s*/, '')}</span>
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
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border-strong text-center text-[12px] text-muted">
        {WEEKDAYS_SHORT_KA.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = map.get(k) ?? [];
          const other = d.getMonth() !== cursor.getMonth();
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              onClick={() => onDay(d)}
              onKeyDown={(e) => e.key === 'Enter' && onDay(d)}
              aria-label={`${dayLabel(d)}: ${list.length}`}
              className={cn('flex min-h-16 flex-col gap-0.5 border-b border-r border-border p-1 text-left hover:bg-surface-2 md:min-h-24', other && 'bg-bg/60')}
            >
              <span className={cn('self-end rounded-full px-1.5 text-[12px] tabular', k === today ? 'bg-primary text-primary-contrast' : other ? 'text-muted/60' : 'text-muted')}>{d.getDate()}</span>
              <div className="hidden flex-col gap-0.5 md:flex">
                {list.slice(0, 3).map((v) => (
                  <Chip key={v.id} v={v} onOpen={onOpen} />
                ))}
                {list.length > 3 && <span className="px-1 text-[11px] text-muted">{t('more', { count: list.length - 3 })}</span>}
              </div>
              {list.length > 0 && (
                <span className="flex gap-0.5 md:hidden" aria-hidden>
                  {list.slice(0, 4).map((v) => (
                    <span key={v.id} className={cn('size-1.5 rounded-full', v.status === 'done' ? 'bg-success' : v.status === 'cancelled' ? 'bg-border-strong' : 'bg-primary')} />
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

export function WeekView({ cursor, items, onOpen, onDay }: { cursor: Date; items: CrmViewing[]; onOpen: (v: CrmViewing) => void; onDay: (d: Date) => void }) {
  const map = byDay(items);
  const first = startOfWeek(cursor);
  const today = dayKey(new Date());
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => addDays(first, i)).map((d, i) => {
        const k = dayKey(d);
        const list = map.get(k) ?? [];
        return (
          <section key={k} className={cn('flex min-h-24 flex-col gap-1 rounded-card border bg-surface p-2', k === today ? 'border-primary' : 'border-border')}>
            <button type="button" onClick={() => onDay(d)} className="flex items-baseline justify-between text-left text-small hover:text-link">
              <span className="font-medium">{WEEKDAYS_SHORT_KA[i]}</span>
              <span className="tabular text-muted">{dayLabel(d)}</span>
            </button>
            {list.map((v) => (
              <Chip key={v.id} v={v} onOpen={onOpen} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function DayView({ items, onOpen }: { items: CrmViewing[]; onOpen: (v: CrmViewing) => void }) {
  const t = useTranslations('calendar');
  return (
    <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
      {items.map((v) => (
        <li key={v.id}>
          <button type="button" onClick={() => onOpen(v)} className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left hover:bg-surface-2">
            <span className="tabular">
              <span className="block font-semibold">{timeHM(v.startsAt)}</span>
              <span className="block text-small text-muted">{timeHM(v.endsAt)}</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{v.title}</span>
              <span className="block truncate text-small text-muted">{[v.contactName, v.address].filter(Boolean).join(' · ') || '—'}</span>
              {v.agentName && <span className="block text-[12px] text-muted">{v.agentName}</span>}
            </span>
            <Badge tone={STATUS_TONE[v.status]}>{t(`status.${v.status}`)}</Badge>
          </button>
        </li>
      ))}
    </ol>
  );
}
