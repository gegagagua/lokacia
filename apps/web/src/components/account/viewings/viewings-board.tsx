'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarDays, CalendarPlus, MapPin, MessageSquare, Phone, Video } from 'lucide-react';
import { formatMoney, type ViewingDto } from '@lokacia/contracts';
import { Badge, Button, Calendar, Dialog, EmptyState, Field, Select, Skeleton, Textarea, useToast, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { ViewingStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';
import { dayHeadingKa, keyToDate, localDayKey, tbDateTimeKa, tbDayKey, tbTime } from './tz';

type Slot = { id: string; kind: 'viewing' | 'short_term'; startsAt: string; endsAt: string; priceMinor: number | null; booked: boolean };
type Role = 'all' | 'visitor' | 'host';
type Status = 'upcoming' | 'past';

function RescheduleDialog({ v, open, onClose, onDone }: { v: ViewingDto; open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('viewings.board');
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
          <Select value={slotId} onChange={(e) => setSlotId(e.target.value)} options={[{ value: '', label: t('chooseTime') }, ...free.map((s) => ({ value: s.id, label: `${tbDateTimeKa(s.startsAt)}–${tbTime(s.endsAt)}${s.priceMinor != null ? ` · ${formatMoney(s.priceMinor)}` : ''}` }))]} />
        </Field>
      )}
    </Dialog>
  );
}

function ViewingItem({ v, highlight, onChanged }: { v: ViewingDto; highlight: boolean; onChanged: () => void }) {
  const t = useTranslations('viewings.board');
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
      router.push(`/account/messages?c=${r.conversationId}`);
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
      setBusy(false);
    }
  };

  return (
    <li ref={ref} id={`viewing-${v.id}`} className={cn('rounded-card border bg-surface p-4', highlight ? 'border-primary ring-1 ring-primary' : 'border-border')}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="shrink-0 sm:w-24">
          <div className="compact text-h3 font-semibold tabular">{tbTime(v.startsAt)}</div>
          <div className="text-small text-muted tabular">–{tbTime(v.endsAt)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <ViewingStatusBadge status={v.status} />
            <Badge tone="outline" icon={v.mode === 'video' ? <Video className="size-3.5" strokeWidth={1.5} aria-hidden /> : <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden />}>
              {v.kind === 'short_term' ? t('shortTerm') : t(`mode.${v.mode}`)}
            </Badge>
            <Badge tone="neutral">{v.myRole === 'visitor' ? t('roleVisitor') : t('roleHost')}</Badge>
            {v.priceMinor != null && <span className="text-small font-medium tabular">{formatMoney(v.priceMinor)}</span>}
          </div>
          <Link href={`/listings/${v.listing.slug}`} className="line-clamp-1 font-medium hover:underline">
            {v.listing.title}
          </Link>
          <p className="truncate text-small text-muted">{v.listing.address}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
            <span>
              {v.myRole === 'visitor' ? t('host') : t('visitor')}: {counterpart.name ?? '—'}
            </span>
            {counterpart.phone && (
              <a href={`tel:${counterpart.phone}`} className="inline-flex items-center gap-1 text-link tabular underline-offset-4 hover:underline">
                <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
                {counterpart.phone}
              </a>
            )}
          </p>
          {v.videoUrl && active && (
            <a href={v.videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-small text-link underline underline-offset-4">
              <Video className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              {t('joinVideo')}
            </a>
          )}
          {v.note && <p className="mt-2 whitespace-pre-wrap rounded-button bg-surface-2 p-2 text-small">{v.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {v.myRole === 'host' && v.status === 'requested' && (
              <Button size="sm" loading={busy} onClick={() => act('confirm', undefined, t('confirmed'))}>
                {t('confirm')}
              </Button>
            )}
            {v.myRole === 'host' && v.status === 'confirmed' && !future && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => act('done', undefined, t('markedDone'))}>
                {t('markDone')}
              </Button>
            )}
            {active && future && v.slotId && (
              <Button size="sm" variant="secondary" onClick={() => setDialog('reschedule')}>
                {t('reschedule')}
              </Button>
            )}
            {active && future && (
              <Button size="sm" variant="danger" onClick={() => setDialog('cancel')}>
                {t('cancel')}
              </Button>
            )}
            {active && (
              <Button asChild size="sm" variant="ghost">
                <a href={v.icsUrl} download>
                  <CalendarPlus className="size-4" strokeWidth={1.5} aria-hidden />
                  {t('ics')}
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setDialog('message')}>
              {t('message')}
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={dialog === 'cancel'} onOpenChange={(o) => !o && setDialog(null)} title={t('cancelTitle')} description={`${v.listing.title} — ${tbDateTimeKa(v.startsAt)}`}
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
        <div className="inline-flex rounded-button border border-border p-0.5" role="tablist" aria-label={t('statusLabel')}>
          {(['upcoming', 'past'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setDay(null); }} className={cn('h-9 rounded-[5px] px-4 text-[15px]', status === s ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text')}>
              {t(`status.${s}`)}
            </button>
          ))}
        </div>
        <Field label={t('roleLabel')} className="sm:w-64">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} options={[{ value: 'all', label: t('role.all') }, { value: 'visitor', label: t('role.visitor') }, { value: 'host', label: t('role.host') }]} />
        </Field>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Calendar value={day ? keyToDate(day) : null} onChange={(d) => setDay((cur) => (cur === localDayKey(d) ? null : localDayKey(d)))} events={events} />
          {day && (
            <Button variant="link" size="sm" onClick={() => setDay(null)} className="self-start">
              {t('showAllDays')}
            </Button>
          )}
        </div>
        <div className="min-w-0" aria-live="polite">
          {isLoading ? (
            <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-card" />)}</div>
          ) : error ? (
            <p className="text-danger" role="alert">{t('loadError')}</p>
          ) : groups.size === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" strokeWidth={1.5} />}
              title={day ? t('emptyDay') : t(`empty.${status}`)}
              description={t('emptyHint')}
              action={<Button asChild><Link href="/search">{t('searchCta')}</Link></Button>}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {[...groups.entries()].map(([k, vs]) => (
                <section key={k} aria-label={dayHeadingKa(k)}>
                  <h2 className="mb-2 text-small font-medium uppercase tracking-wide text-muted">{dayHeadingKa(k)}</h2>
                  <ul className="flex flex-col gap-3">
                    {vs.map((v) => <ViewingItem key={v.id} v={v} highlight={v.id === highlightId} onChanged={() => void mutate()} />)}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
