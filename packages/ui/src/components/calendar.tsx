'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS_KA } from '@lokacia/contracts';
import { cn } from '../lib/cn';

const WD = ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type CalendarEvent = { id: string; date: Date; label: string; tone?: 'primary' | 'accent' | 'muted' };

/** Month calendar (Monday first) with event dots and day selection. */
export function Calendar({ value, onChange, events = [], minDate, className, renderDay }: { value?: Date | null; onChange?: (d: Date) => void; events?: CalendarEvent[]; minDate?: Date; className?: string; renderDay?: (d: Date, events: CalendarEvent[]) => React.ReactNode }) {
  const [month, setMonth] = React.useState(() => {
    const d = value ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const byDay = React.useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) m.set(key(e.date), [...(m.get(key(e.date)) ?? []), e]);
    return m;
  }, [events]);
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = key(new Date());
  return (
    <div className={cn('rounded-card border border-border bg-surface p-4 shadow-sm', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text" aria-label="წინა თვე">
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="font-semibold">
          {MONTHS_KA[month.getMonth()]} {month.getFullYear()}
        </div>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text" aria-label="შემდეგი თვე">
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-muted" aria-hidden>
        {WD.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label={`${MONTHS_KA[month.getMonth()]} ${month.getFullYear()}`}>
        {days.map((d) => {
          const k = key(d);
          const ev = byDay.get(k) ?? [];
          const disabled = !!minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
          const selected = value && key(value) === k;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(d)}
              aria-pressed={!!selected}
              aria-label={`${d.getDate()} ${MONTHS_KA[d.getMonth()]}${ev.length ? `, ${ev.length} ღონისძიება` : ''}`}
              className={cn(
                'relative flex min-h-10 flex-col items-center justify-start rounded-xl border px-0.5 pt-1 text-small font-medium tabular transition-all duration-200',
                d.getMonth() !== month.getMonth() ? 'text-muted' : 'text-text',
                selected ? 'border-primary bg-primary text-primary-contrast shadow-sm' : 'border-transparent hover:bg-surface-2',
                k === today && !selected && 'border-primary/40 bg-primary-soft text-primary-soft-text',
                disabled && 'opacity-40',
              )}
            >
              {d.getDate()}
              {renderDay ? renderDay(d, ev) : ev.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {ev.slice(0, 3).map((e) => (
                    <span key={e.id} className={cn('size-1.5 rounded-full', e.tone === 'accent' ? 'bg-accent' : e.tone === 'muted' ? 'bg-border-strong' : selected ? 'bg-primary-contrast' : 'bg-primary')} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
