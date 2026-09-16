'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarCheck, CalendarPlus, CalendarX2, CheckCircle2, MapPin, Video } from 'lucide-react';
import type { ViewingDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Field, Input, Skeleton, Textarea, useToast, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { TenantProfileSummary, type BusinessTypeOption, type TenantProfileValue } from '../offers/tenant-profile';
import { dayHeadingKa, keyToDate, localDayKey, tbDateTimeKa, tbDayKey, tbTileParts, tbTime } from './tz';
import { DateTile } from '../ui';

type Slot = { id: string; kind: 'viewing' | 'short_term'; startsAt: string; endsAt: string; priceMinor: number | null; booked: boolean };

export function BookingForm({ listing, profile, userName, businessTypes }: { listing: { id: string; slug: string; dealType: string; priceHourMinor: number | null; priceDayMinor: number | null }; profile: TenantProfileValue | null; userName: string | null; businessTypes: BusinessTypeOption[] }) {
  const t = useTranslations('viewings.book');
  const f = useFormat();
  const toast = useToast();
  const kind = listing.dealType === 'short_term' ? 'short_term' : 'viewing';
  const { data: slots, isLoading, mutate } = useSWR<Slot[]>(`/listings/${listing.id}/slots?kind=${kind}`, fetcher);
  const free = React.useMemo(() => (slots ?? []).filter((s) => !s.booked && new Date(s.startsAt) > new Date()), [slots]);
  const days = React.useMemo(() => [...new Set(free.map((s) => tbDayKey(s.startsAt)))].sort(), [free]);
  const [dayKey, setDayKey] = React.useState<string | null>(null);
  const [slotId, setSlotId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'onsite' | 'video'>('onsite');
  const [note, setNote] = React.useState('');
  const [freeTime, setFreeTime] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<ViewingDto | null>(null);

  React.useEffect(() => {
    if (!dayKey && days[0]) setDayKey(days[0]);
  }, [days, dayKey]);

  const daySlots = free.filter((s) => dayKey && tbDayKey(s.startsAt) === dayKey);
  const selected = free.find((s) => s.id === slotId) ?? null;
  const noSlots = !isLoading && free.length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotId && !(noSlots && freeTime)) {
      toast({ title: noSlots ? t('pickFreeTime') : t('pickSlot'), tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      const body = slotId ? { listingId: listing.id, slotId, mode: kind === 'short_term' ? 'onsite' : mode, note: note.trim() || null } : { listingId: listing.id, startsAt: new Date(freeTime).toISOString(), mode, note: note.trim() || null };
      const v = await apiFetch<ViewingDto>('/viewings', { method: 'POST', body });
      setDone(v);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 409) {
        setSlotId(null);
        await mutate();
      }
      toast({ title: err instanceof ClientApiError ? err.message : t('error'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <section className="card flex flex-col items-center gap-5 overflow-hidden p-6 text-center sm:p-10" role="status" aria-live="polite">
        <div className="relative">
          <span aria-hidden className="absolute -inset-4 rounded-full bg-success/10" />
          <span className="relative grid size-16 place-items-center rounded-full bg-success text-white shadow-md dark:text-bg" aria-hidden>
            <CheckCircle2 className="size-8" strokeWidth={2} />
          </span>
        </div>
        <h2 className="text-[26px] font-bold tracking-tight">{done.status === 'requested' ? t('doneRequested') : done.kind === 'short_term' ? t('doneShortTerm') : t('done')}</h2>
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 px-5 py-3 text-left">
          <DateTile day={tbTileParts(done.startsAt, f.locale).day} month={tbTileParts(done.startsAt, f.locale).month} />
          <div>
            <div className="text-[18px] font-bold tabular">
              {tbTime(done.startsAt)}–{tbTime(done.endsAt)}
            </div>
            <div className="text-small text-muted">{dayHeadingKa(tbDayKey(done.startsAt), f.locale)}</div>
            {done.priceMinor != null && (
              <div className="text-small">
                {t('price')}: <span className="font-bold tabular">{f.money(done.priceMinor)}</span>
              </div>
            )}
          </div>
        </div>
        {done.status === 'requested' && <p className="max-w-md text-muted">{t('requestedHint')}</p>}
        {done.videoUrl && (
          <p className="max-w-md">
            {t('videoLink')}:{' '}
            <a href={done.videoUrl} target="_blank" rel="noreferrer" className="break-all font-medium text-link underline underline-offset-4">
              {done.videoUrl}
            </a>
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <a href={done.icsUrl} download>
              <CalendarPlus className="size-4" strokeWidth={2} aria-hidden />
              {t('ics')}
            </a>
          </Button>
          <Button asChild>
            <Link href={`/account/viewings?v=${done.id}`}>{t('myViewings')}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/listings/${listing.slug}/offer`}>{t('makeOffer')}</Link>
          </Button>
        </div>
      </section>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {kind === 'viewing' && (
        <section className="card p-5 sm:p-6">
          <fieldset>
            <legend className="mb-3 text-[17px] font-bold">{t('mode')}</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('mode')}>
              {(['onsite', 'video'] as const).map((m) => {
                const Icon = m === 'onsite' ? MapPin : Video;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(m)}
                    className={cn('relative flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none', active ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'border-border bg-surface shadow-xs hover:-translate-y-0.5 hover:shadow-md')}
                  >
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', active ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-primary-soft-text')} aria-hidden>
                      <Icon className="size-5" strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block font-semibold">{t(`modes.${m}`)}</span>
                      <span className="block text-small text-muted">{t(`modes.${m}Hint`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
      )}

      <section aria-labelledby="slots-h" className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="slots-h" className="text-[17px] font-bold">
            {kind === 'short_term' ? t('pickPeriod') : t('pickTime')}
          </h2>
          {kind === 'short_term' && (listing.priceHourMinor || listing.priceDayMinor) && (
            <p className="inline-flex flex-wrap gap-1.5 text-small tabular">
              {listing.priceHourMinor ? <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold">{`${f.money(listing.priceHourMinor)} / ${t('hour')}`}</span> : null}
              {listing.priceDayMinor ? <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold">{`${f.money(listing.priceDayMinor)} / ${t('day')}`}</span> : null}
            </p>
          )}
        </div>
        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : noSlots ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-2 font-medium">
              <CalendarX2 className="size-5 text-muted" strokeWidth={2} aria-hidden />
              {t('noSlots')}
            </p>
            <Field label={t('freeTime')} hint={t('freeTimeHint')}>
              <Input type="datetime-local" value={freeTime} min={localDayKey(new Date()) + 'T00:00'} onChange={(e) => setFreeTime(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" role="radiogroup" aria-label={t('day')}>
              {days.map((k) => {
                const d = keyToDate(k);
                const active = dayKey === k;
                const count = free.filter((x) => tbDayKey(x.startsAt) === k).length;
                const parts = tbTileParts(free.find((x) => tbDayKey(x.startsAt) === k)!.startsAt, f.locale);
                return (
                  <div key={k} className="shrink-0">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${dayHeadingKa(k, f.locale)} (${count})`}
                      onClick={() => {
                        setDayKey(k);
                        setSlotId(null);
                      }}
                      className={cn('flex w-[72px] flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none', active ? 'border-primary bg-primary text-primary-contrast shadow-md' : 'border-border bg-surface shadow-xs hover:-translate-y-0.5 hover:border-border-strong')}
                    >
                      <span className={cn('text-[12px] font-semibold', active ? 'opacity-85' : 'text-muted')}>{parts.weekday}</span>
                      <span className="text-[22px] font-bold leading-7 tabular">{d.getDate()}</span>
                      <span className={cn('text-[12px]', active ? 'opacity-85' : 'text-muted')}>{parts.month}</span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="min-w-0">
              <div className="mb-3 text-[15px] font-semibold">{dayKey ? dayHeadingKa(dayKey, f.locale) : ''}</div>
              {daySlots.length === 0 ? (
                <p className="text-small text-muted">{t('dayEmpty')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={t('pickTime')}>
                  {daySlots.map((sl) => {
                    const active = slotId === sl.id;
                    return (
                      <div key={sl.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSlotId(sl.id)}
                          className={cn('flex h-12 w-full flex-col items-center justify-center rounded-full border px-3 text-[15px] font-semibold tabular transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none', active ? 'border-primary bg-primary text-primary-contrast shadow-md' : 'border-border bg-surface hover:border-primary/50 hover:bg-primary-soft/50')}
                        >
                          <span className="leading-tight">
                            {tbTime(sl.startsAt)}–{tbTime(sl.endsAt)}
                          </span>
                          {sl.priceMinor != null && <span className={cn('text-[11.5px] font-medium leading-tight', active ? 'opacity-85' : 'text-muted')}>{f.money(sl.priceMinor)}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div aria-live="polite">
                {selected && (
                  <p className="mt-4 flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-[15px] text-primary-soft-text">
                    <CalendarCheck className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                    <span>
                      {t('summary', { when: `${tbDateTimeKa(selected.startsAt, f.locale)}–${tbTime(selected.endsAt)}` })}
                      {selected.priceMinor != null && <span className="font-bold tabular"> · {f.money(selected.priceMinor)}</span>}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-5 p-5 sm:p-6">
        <Field label={t('note')} hint={t('noteHint')}>
          <Textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">{t('profileTitle')}</h2>
          <p className="-mt-1 text-small text-muted">{t('profileHint')}</p>
          <TenantProfileSummary
            profile={profile}
            name={userName}
            businessTypes={businessTypes}
            className="shadow-none"
            action={
              <Link href="/account/profile?tab=tenant" className="shrink-0 text-small font-semibold text-link underline-offset-4 hover:underline">
                {profile ? t('profileEdit') : t('profileFill')}
              </Link>
            }
          />
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex">
        <Button type="submit" size="lg" loading={busy} className="w-full shadow-lg sm:w-auto" icon={<CalendarCheck className="size-5" strokeWidth={2} aria-hidden />}>
          {kind === 'short_term' ? t('submitShortTerm') : noSlots ? t('submitRequest') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
