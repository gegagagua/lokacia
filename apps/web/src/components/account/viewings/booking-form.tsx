'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarPlus, CheckCircle2, MapPin, Video } from 'lucide-react';
import type { ViewingDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Calendar, Field, Input, Skeleton, Textarea, useToast, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { TenantProfileSummary, type BusinessTypeOption, type TenantProfileValue } from '../offers/tenant-profile';
import { dayHeadingKa, keyToDate, localDayKey, tbDateTimeKa, tbDayKey, tbTime } from './tz';

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
  const events = free.map((s) => ({ id: s.id, date: keyToDate(tbDayKey(s.startsAt)), label: tbTime(s.startsAt), tone: 'primary' as const }));

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
      <section className="mt-6 flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-5" role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-6 text-success" strokeWidth={1.5} aria-hidden />
          <h2 className="text-h3 font-semibold">{done.status === 'requested' ? t('doneRequested') : done.kind === 'short_term' ? t('doneShortTerm') : t('done')}</h2>
        </div>
        <p className="text-[17px] tabular">{tbDateTimeKa(done.startsAt, f.locale)}–{tbTime(done.endsAt)}</p>
        {done.priceMinor != null && <p>{t('price')}: <span className="font-semibold tabular">{f.money(done.priceMinor)}</span></p>}
        {done.status === 'requested' && <p className="text-muted">{t('requestedHint')}</p>}
        {done.videoUrl && (
          <p>
            {t('videoLink')}:{' '}
            <a href={done.videoUrl} target="_blank" rel="noreferrer" className="break-all text-link underline underline-offset-4">
              {done.videoUrl}
            </a>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={done.icsUrl} download>
              <CalendarPlus className="size-4" strokeWidth={1.5} aria-hidden />
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
    <form onSubmit={submit} className="mt-6 flex flex-col gap-6" noValidate>
      {kind === 'viewing' && (
        <fieldset>
          <legend className="mb-2 text-small font-medium">{t('mode')}</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {(['onsite', 'video'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn('flex items-start gap-3 rounded-card border p-4 text-left transition-colors', mode === m ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-border-strong')}
              >
                {m === 'onsite' ? <MapPin className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden /> : <Video className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />}
                <span>
                  <span className="block font-medium">{t(`modes.${m}`)}</span>
                  <span className="block text-small text-muted">{t(`modes.${m}Hint`)}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <section aria-labelledby="slots-h">
        <h2 id="slots-h" className="mb-3 text-h3 font-semibold">{kind === 'short_term' ? t('pickPeriod') : t('pickTime')}</h2>
        {kind === 'short_term' && (listing.priceHourMinor || listing.priceDayMinor) && (
          <p className="mb-3 text-small text-muted tabular">
            {[listing.priceHourMinor ? `${f.money(listing.priceHourMinor)} / ${t('hour')}` : null, listing.priceDayMinor ? `${f.money(listing.priceDayMinor)} / ${t('day')}` : null].filter(Boolean).join(' · ')}
          </p>
        )}
        {isLoading ? (
          <Skeleton className="h-72 rounded-card" />
        ) : noSlots ? (
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="mb-3">{t('noSlots')}</p>
            <Field label={t('freeTime')} hint={t('freeTimeHint')}>
              <Input type="datetime-local" value={freeTime} min={localDayKey(new Date()) + 'T00:00'} onChange={(e) => setFreeTime(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <Calendar
              value={dayKey ? keyToDate(dayKey) : null}
              onChange={(d) => {
                setDayKey(localDayKey(d));
                setSlotId(null);
              }}
              events={events}
              minDate={new Date()}
            />
            <div className="min-w-0">
              <div className="mb-2 font-medium">{dayKey ? dayHeadingKa(dayKey, f.locale) : ''}</div>
              {daySlots.length === 0 ? (
                <p className="text-small text-muted">{t('dayEmpty')}</p>
              ) : (
                <ul className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pickTime')}>
                  {daySlots.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={slotId === s.id}
                        onClick={() => setSlotId(s.id)}
                        className={cn('h-10 rounded-button border px-3 text-[15px] tabular transition-colors', slotId === s.id ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:bg-surface-2')}
                      >
                        {tbTime(s.startsAt)}–{tbTime(s.endsAt)}
                        {s.priceMinor != null && <span className={slotId === s.id ? '' : 'text-muted'}> · {f.money(s.priceMinor)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selected && (
                <p className="mt-4 rounded-card border border-border bg-surface-2 p-3 text-[15px]" aria-live="polite">
                  {t('summary', { when: `${tbDateTimeKa(selected.startsAt, f.locale)}–${tbTime(selected.endsAt)}` })}
                  {selected.priceMinor != null && <span className="font-semibold tabular"> · {f.money(selected.priceMinor)}</span>}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <Field label={t('note')} hint={t('noteHint')}>
        <Textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <section aria-labelledby="tp-h" className="flex flex-col gap-2">
        <h2 id="tp-h" className="text-h3 font-semibold">{t('profileTitle')}</h2>
        <p className="text-small text-muted">{t('profileHint')}</p>
        <TenantProfileSummary
          profile={profile}
          name={userName}
          businessTypes={businessTypes}
          action={
            <Link href="/account/profile#tenant" className="text-small text-link underline-offset-4 hover:underline">
              {profile ? t('profileEdit') : t('profileFill')}
            </Link>
          }
        />
      </section>

      <div>
        <Button type="submit" size="lg" loading={busy}>
          {kind === 'short_term' ? t('submitShortTerm') : noSlots ? t('submitRequest') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
