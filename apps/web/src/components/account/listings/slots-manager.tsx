'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Calendar, EmptyState, Field, IconButton, Input, Select, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { dayHeadingKa, localDayKey } from '../viewings/tz';

export type Slot = { id: string; kind: 'viewing' | 'short_term'; startsAt: string; endsAt: string; priceMinor: number | null; booked: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Owner availability editor (P15 viewing slots, P21 short-term slots with price).
 * Pick a day → generate a series of slots (start, length, count) → saved via POST /listings/:id/slots.
 */
export function SlotsManager({ listingId, kind, defaultPriceMinor }: { listingId: string; kind: 'viewing' | 'short_term'; defaultPriceMinor?: number | null }) {
  const t = useTranslations('myListings.slotsManager');
  const f = useFormat();
  const toast = useToast();
  const { data: slots = [], mutate } = useSWR<Slot[]>(`/listings/${listingId}/slots?kind=${kind}`, fetcher);
  const [day, setDay] = React.useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [start, setStart] = React.useState(kind === 'viewing' ? '11:00' : '10:00');
  const [length, setLength] = React.useState(kind === 'viewing' ? '30' : '60');
  const [count, setCount] = React.useState(kind === 'viewing' ? '4' : '8');
  const [price, setPrice] = React.useState(defaultPriceMinor ? String(defaultPriceMinor / 100) : '');
  const [busy, setBusy] = React.useState(false);

  const events = slots.map((s) => ({ id: s.id, date: new Date(s.startsAt), label: hm(new Date(s.startsAt)), tone: s.booked ? ('accent' as const) : ('primary' as const) }));
  const daySlots = day ? slots.filter((s) => dayKey(new Date(s.startsAt)) === dayKey(day)) : [];

  const add = async () => {
    if (!day) return;
    const [h, m] = start.split(':').map(Number);
    const len = Number(length);
    const n = Math.max(1, Math.min(48, Number(count) || 1));
    const base = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 10, m ?? 0);
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Date(base.getTime() + i * len * 60_000);
      return { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + len * 60_000).toISOString(), priceMinor: kind === 'short_term' && price ? Math.round(Number(price) * 100) : null };
    }).filter((x) => new Date(x.startsAt) > new Date());
    if (!items.length) {
      toast({ title: t('pickFuture'), tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/listings/${listingId}/slots`, { method: 'POST', body: { kind, slots: items } });
      await mutate();
      toast({ title: t('added', { count: items.length }), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/listings/${listingId}/slots/${id}`, { method: 'DELETE' });
      await mutate();
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('deleteError'), tone: 'danger' });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <Calendar value={day} onChange={setDay} events={events} minDate={new Date()} />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="mb-3 font-medium">{day ? dayHeadingKa(localDayKey(day), f.locale) : t('pickDay')}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={t('start')}>
              <Input type="time" value={start} step={900} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t('duration')}>
              <Select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                options={(kind === 'viewing' ? [15, 30, 45, 60] : [60, 120, 240, 480, 720, 1440]).map((v) => ({ value: String(v), label: v < 60 ? t('minutes', { n: v }) : v === 1440 ? t('day') : t('hours', { n: v / 60 }) }))}
              />
            </Field>
            <Field label={t('count')}>
              <Input type="number" min={1} max={48} value={count} onChange={(e) => setCount(e.target.value)} />
            </Field>
            {kind === 'short_term' && (
              <Field label={t('price')}>
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            )}
          </div>
          <Button className="mt-3" onClick={add} loading={busy} disabled={!day}>
            {kind === 'viewing' ? t('addViewing') : t('addShortTerm')}
          </Button>
        </div>
        <div>
          <div className="mb-2 text-small text-muted">{day ? t('dayTimes') : ''}</div>
          {daySlots.length === 0 ? (
            <EmptyState title={t('emptyTitle')} description={t('emptyText')} className="py-6" />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {daySlots.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-button border border-border bg-surface py-1 pl-3 pr-1 text-small tabular">
                  {hm(new Date(s.startsAt))}–{hm(new Date(s.endsAt))}
                  {s.priceMinor != null && <span className="text-muted">· {f.money(s.priceMinor)}</span>}
                  {s.booked ? (
                    <Badge tone="accent" className="ml-1">{t('booked')}</Badge>
                  ) : (
                    <IconButton label={t('delete')} size="sm" onClick={() => remove(s.id)}>
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
