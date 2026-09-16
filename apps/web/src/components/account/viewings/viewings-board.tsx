'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarClock, CalendarDays, CalendarPlus, CheckCircle2, MapPin, MessageSquare, Phone, Video } from 'lucide-react';
import type { ViewingDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Button, Calendar, Dialog, Field, Select, Skeleton, Textarea, useToast, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { ViewingStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';
import { dayHeadingKa, keyToDate, localDayKey, tbDateTimeKa, tbDayKey, tbTileParts, tbTime } from './tz';
import { AccountEmpty, DateTile, Segmented } from '../ui';

type Slot = { id: string; kind: 'viewing' | 'short_term'; startsAt: string; endsAt: string; priceMinor: number | null; booked: boolean };
type Role = 'all' | 'visitor' | 'host';
type Status = 'upcoming' | 'past';

function RescheduleDialog({ v, open, onClose, onDone }: { v: ViewingDto; open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('viewings.board');
  const f = useFormat();
  const toast = useToast();
  const { data: slots } = useSWR<Slot[]>(open ? `/listings/${v.listingId}/slots?kind=${v.kind}` : null, fetcher);
  const free = (slots ?? []).filter((s) => !s.booked && new Date(s.startsAt) > new Date());
  const [slotId, setSlotId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (!slotId) return;
    setBusy(true);
    try {
      await apiFetch(`/viewings/${v.id}/reschedule`, { method: 'POST', body: { slotId } });
      toast({ title: t('rescheduled'), tone: 'success' });
      onDone();
      onClose();
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={t('rescheduleTitle')} description={v.listing.title}
      footer={<><Button variant="ghost" onClick={onClose}>{t('close')}</Button><Button loading={busy} disabled={!slotId} onClick={submit}>{t('rescheduleSubmit')}</Button></>}>
      {!slots ? (
        <Skeleton className="h-10" />
      ) : free.length === 0 ? (
        <p className="text-muted">{t('noFreeSlots')}</p>
      ) : (
        <Field label={t('newTime')}>
          <Select value={slotId} onChange={(e) => setSlotId(e.target.value)} options={[{ value: '', label: t('chooseTime') }, ...free.map((s) => ({ value: s.id, label: `${tbDateTimeKa(s.startsAt, f.locale)}–${tbTime(s.endsAt)}${s.priceMinor != null ? ` · ${f.money(s.priceMinor)}` : ''}` }))]} />
        </Field>
      )}
    </Dialog>
  );
}

function ViewingItem({ v, highlight, onChanged }: { v: ViewingDto; highlight: boolean; onChanged: () => void }) {
  const t = useTranslations('viewings.board');
  const f = useFormat();
  const lp = useLocalizedPath();
  const router = useRouter();
  const toast = useToast();
  const ref = React.useRef<HTMLLIElement>(null);
  const [dialog, setDialog] = React.useState<null | 'cancel' | 'reschedule' | 'message'>(null);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  const counterpart = v.myRole === 'visitor' ? v.host : v.visitor;
  const active = v.status === 'requested' || v.status === 'confirmed';
  const future = new Date(v.endsAt) > new Date();

  const act = async (path: string, body: unknown, success: string) => {
    setBusy(true);
    try {
      await apiFetch(`/viewings/${v.id}/${path}`, { method: 'POST', body });
      toast({ title: success, tone: 'success' });
      setDialog(null);
      setText('');
      onChanged();
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  const message = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ conversationId: string }>('/conversations/with-user', { method: 'POST', body: { userId: counterpart.id, listingId: v.listingId, body: text.trim() } });
      router.push(lp(`/account/messages?c=${r.conversationId}`));
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
      setBusy(false);
    }
  };

  const tone = v.status === 'requested' ? 'accent' : v.status === 'cancelled' ? 'neutral' : 'primary';
  return (
    <li ref={ref} id={`viewing-${v.id}`} className={cn('card overflow-hidden transition-shadow duration-200 hover:shadow-md', highlight && 'ring-2 ring-primary', v.status === 'cancelled' && 'opacity-75')}>
      <div className="flex flex-col sm:flex-row">
        <div className={cn('flex shrink-0 items-center gap-3 px-4 py-3 sm:w-40 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5 sm:py-5 sm:pl-5', tone === 'accent' ? 'bg-accent-soft' : tone === 'neutral' ? 'bg-surface-2' : 'bg-primary-soft')}>
          <div className="text-[24px] font-bold leading-8 tracking-tight tabular">{tbTime(v.startsAt)}</div>
          <div className="text-small font-medium text-muted tabular">–{tbTime(v.endsAt)}</div>
          <div className="ml-auto sm:ml-0 sm:mt-2">
            <ViewingStatusBadge status={v.status} />
          </div>
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-[12.5px] font-semibold">
              {v.mode === 'video' ? <Video className="size-3.5" strokeWidth={2} aria-hidden /> : <MapPin className="size-3.5" strokeWidth={2} aria-hidden />}
              {v.kind === 'short_term' ? t('shortTerm') : t(`mode.${v.mode}`)}
            </span>
            <span className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-[12.5px] font-semibold', v.myRole === 'host' ? 'bg-primary-soft text-primary-soft-text' : 'bg-link/10 text-link')}>{v.myRole === 'visitor' ? t('roleVisitor') : t('roleHost')}</span>
            {v.priceMinor != null && <span className="ml-auto text-[15px] font-bold tabular">{f.money(v.priceMinor)}</span>}
          </div>
          <Link href={`/listings/${v.listing.slug}`} className="line-clamp-1 text-[17px] font-bold hover:text-link">
            {v.listing.title}
          </Link>
          <p className="truncate text-small text-muted">{v.listing.address}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14.5px]">
            <span className="inline-flex items-center gap-2">
              <Avatar name={counterpart.name ?? '?'} size={28} />
              <span className="text-muted">{v.myRole === 'visitor' ? t('host') : t('visitor')}:</span>
              <span className="font-semibold">{counterpart.name ?? '—'}</span>
            </span>
            {counterpart.phone && (
              <a href={`tel:${counterpart.phone}`} className="inline-flex items-center gap-1 font-medium text-link tabular underline-offset-4 hover:underline">
                <Phone className="size-3.5" strokeWidth={2} aria-hidden />
                {counterpart.phone}
              </a>
            )}
            {v.videoUrl && active && (
              <a href={v.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-link underline-offset-4 hover:underline">
                <Video className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {t('joinVideo')}
              </a>
            )}
          </div>
          {v.note && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-surface-2 px-3.5 py-2.5 text-small">{v.note}</p>}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            {v.myRole === 'host' && v.status === 'requested' && (
              <Button size="sm" loading={busy} onClick={() => act('confirm', undefined, t('confirmed'))} icon={<CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />}>
                {t('confirm')}
              </Button>
            )}
            {v.myRole === 'host' && v.status === 'confirmed' && !future && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => act('done', undefined, t('markedDone'))}>
                {t('markDone')}
              </Button>
            )}
            {active && future && v.slotId && (
              <Button size="sm" variant="secondary" onClick={() => setDialog('reschedule')} icon={<CalendarClock className="size-4" strokeWidth={2} aria-hidden />}>
                {t('reschedule')}
              </Button>
            )}
            {active && (
              <Button asChild size="sm" variant="ghost">
                <a href={v.icsUrl} download>
                  <CalendarPlus className="size-4" strokeWidth={2} aria-hidden />
                  {t('ics')}
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setDialog('message')}>
              {t('message')}
            </Button>
            {active && future && (
              <Button size="sm" variant="danger" className="sm:ml-auto" onClick={() => setDialog('cancel')}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Dialog open={dialog === 'cancel'} onOpenChange={(o) => !o && setDialog(null)} title={t('cancelTitle')} description={`${v.listing.title} — ${tbDateTimeKa(v.startsAt, f.locale)}`}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('close')}</Button><Button variant="danger" loading={busy} onClick={() => act('cancel', { reason: text.trim() || null }, t('cancelled'))}>{t('cancelSubmit')}</Button></>}>
        <Field label={t('reason')} hint={t('reasonHint')}>
          <Textarea value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Dialog>
      <Dialog open={dialog === 'message'} onOpenChange={(o) => !o && setDialog(null)} title={t('messageTitle', { name: counterpart.name ?? '—' })}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('close')}</Button><Button loading={busy} disabled={!text.trim()} onClick={message}>{t('messageSubmit')}</Button></>}>
        <Field label={t('messageLabel')}>
          <Textarea value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Dialog>
      {dialog === 'reschedule' && <RescheduleDialog v={v} open onClose={() => setDialog(null)} onDone={onChanged} />}
    </li>
  );
}

export function ViewingsBoard({ highlightId }: { highlightId: string | null }) {
  const t = useTranslations('viewings.board');
  const tv = useTranslations('viewings.status');
  const f = useFormat();
  const [role, setRole] = React.useState<Role>('all');
  const [status, setStatus] = React.useState<Status>('upcoming');
  const [day, setDay] = React.useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<ViewingDto[]>(`/viewings?role=${role}&status=${status}`, fetcher, { refreshInterval: 60_000 });
  // deep link to a past/cancelled viewing: switch tab once when it is not in the upcoming list
  const { data: single } = useSWR<ViewingDto>(highlightId ? `/viewings/${highlightId}` : null, fetcher);
  React.useEffect(() => {
    if (single && (single.status === 'cancelled' || single.status === 'done' || new Date(single.endsAt) < new Date())) setStatus('past');
  }, [single]);
  useRealtime('notification', () => void mutate());

  const items = (data ?? []).filter((v) => !day || tbDayKey(v.startsAt) === day);
  const groups = new Map<string, ViewingDto[]>();
  for (const v of items) groups.set(tbDayKey(v.startsAt), [...(groups.get(tbDayKey(v.startsAt)) ?? []), v]);
  const events = (data ?? []).map((v) => ({ id: v.id, date: keyToDate(tbDayKey(v.startsAt)), label: tbTime(v.startsAt), tone: v.status === 'requested' ? ('accent' as const) : v.status === 'cancelled' ? ('muted' as const) : ('primary' as const) }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          role="tablist"
          label={t('statusLabel')}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setDay(null);
          }}
          options={(['upcoming', 'past'] as const).map((x) => ({ value: x, label: t(`status.${x}`) }))}
        />
        <Segmented label={t('roleLabel')} value={role} onChange={setRole} options={(['all', 'visitor', 'host'] as const).map((x) => ({ value: x, label: t(`role.${x}`) }))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="order-2 flex flex-col gap-3 lg:sticky lg:top-24 lg:order-1 lg:self-start">
          <Calendar className="card border-border p-4" value={day ? keyToDate(day) : null} onChange={(d) => setDay((cur) => (cur === localDayKey(d) ? null : localDayKey(d)))} events={events} />
          <div className="card flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-[12.5px] text-muted" aria-hidden>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />{t('status.upcoming')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />{tv('requested')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-border-strong" />{tv('cancelled')}</span>
          </div>
          {day && (
            <Button variant="secondary" size="sm" onClick={() => setDay(null)} className="self-start">
              {t('showAllDays')}
            </Button>
          )}
        </div>
        <div className="order-1 min-w-0 lg:order-2" aria-live="polite">
          {isLoading ? (
            <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-card" />)}</div>
          ) : error ? (
            <p className="text-danger" role="alert">{t('loadError')}</p>
          ) : groups.size === 0 ? (
            <AccountEmpty
              icon={CalendarDays}
              title={day ? t('emptyDay') : t(`empty.${status}`)}
              description={t('emptyHint')}
              action={<Button asChild><Link href="/search">{t('searchCta')}</Link></Button>}
            />
          ) : (
            <div className="flex flex-col gap-7">
              {[...groups.entries()].map(([k, vs]) => {
                const parts = tbTileParts(vs[0]!.startsAt, f.locale);
                return (
                  <section key={k} aria-label={dayHeadingKa(k, f.locale)}>
                    <h2 className="mb-3 flex items-center gap-3">
                      <DateTile day={parts.day} month={parts.month} className="w-12" />
                      <span className="text-[17px] font-bold capitalize">{dayHeadingKa(k, f.locale)}</span>
                      <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2 text-[12px] font-semibold text-muted tabular">{vs.length}</span>
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {vs.map((v) => <ViewingItem key={v.id} v={v} highlight={v.id === highlightId} onChanged={() => void mutate()} />)}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
