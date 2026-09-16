'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, CalendarCheck2, CalendarSync, CalendarX2, ChevronRight, ExternalLink, MapPin, RefreshCw, SquareKanban, UserRound, type LucideIcon } from 'lucide-react';
import { formatDateTimeKa, type CrmViewing } from '@lokacia/contracts';
import { Button, cn, Drawer, Field, Input, useToast } from '@lokacia/ui';
import { IconTile, PersonAvatar, Pill, type Tone } from '@/components/common/ui';
import { CallButton } from '@/components/common/call-button';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';
import { timeHM, toLocalInput, WEEKDAYS_SHORT_KA } from './dates';

export const STATUS_TONE = { planned: 'primary', done: 'success', cancelled: 'outline' } as const;

export function ViewingDrawer({ viewing, onOpenChange, onChanged }: { viewing: CrmViewing | null; onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const t = useTranslations('calendar');
  const toast = useToast();
  const mutate = useApiMutation();
  const [when, setWhen] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (viewing) setWhen(toLocalInput(viewing.startsAt));
  }, [viewing]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      toast({ title: t('drawer.updated'), tone: 'success' });
      onChanged();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const tone = STATUS_TONE_UI[viewing?.status ?? 'planned'];
  const start = viewing ? new Date(viewing.startsAt) : null;
  return (
    <Drawer open={!!viewing} onOpenChange={onOpenChange} title={viewing?.title ?? t('drawer.title')}>
      {viewing && start && (
        <div className="flex flex-col gap-5">
          <div className={cn('flex items-center gap-4 rounded-2xl bg-tone-soft p-4', tone)}>
            <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-surface py-1.5 shadow-xs">
              <span className="text-[22px] font-bold leading-7 tabular">{start.getDate()}</span>
              <span className="text-[11px] font-semibold uppercase text-muted">{WEEKDAYS_SHORT_KA[(start.getDay() + 6) % 7]}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-bold leading-6 tabular text-tone-ink">
                {timeHM(viewing.startsAt)}–{timeHM(viewing.endsAt)}
              </div>
              <div className="text-small text-muted">{formatDateTimeKa(viewing.startsAt)}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill tone={PILL_TONE[viewing.status]} dot size="sm">
                  {t(`status.${viewing.status}`)}
                </Pill>
                {viewing.routeOrder && <Pill tone="link" size="sm">№ {viewing.routeOrder}</Pill>}
              </div>
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-[14px]">
            {viewing.address && (
              <InfoRow icon={MapPin} label={t('drawer.address')}>
                {viewing.address}
                {viewing.lat != null && viewing.lng != null && (
                  <a href={`https://www.openstreetmap.org/?mlat=${viewing.lat}&mlon=${viewing.lng}#map=17/${viewing.lat}/${viewing.lng}`} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-small font-medium text-link hover:underline">
                    OpenStreetMap <ExternalLink className="size-3" strokeWidth={2} aria-hidden />
                  </a>
                )}
              </InfoRow>
            )}
            {!viewing.address && viewing.lat != null && viewing.lng != null && (
              <InfoRow icon={MapPin} label={t('drawer.address')}>
                <a href={`https://www.openstreetmap.org/?mlat=${viewing.lat}&mlon=${viewing.lng}#map=17/${viewing.lat}/${viewing.lng}`} target="_blank" rel="noreferrer" className="text-link hover:underline">
                  OpenStreetMap
                </a>
              </InfoRow>
            )}
            {viewing.agentName && (
              <InfoRow icon={UserRound} label={t('drawer.agent')}>
                <span className="flex items-center gap-2">
                  <PersonAvatar name={viewing.agentName} size={22} />
                  {viewing.agentName}
                </span>
              </InfoRow>
            )}
            <InfoRow icon={CalendarSync} label={t('drawer.google')}>
              <span className={viewing.googleEventId ? 'text-success' : 'text-muted'}>{viewing.googleEventId ? t('drawer.synced') : t('drawer.notSynced')}</span>
            </InfoRow>
          </dl>

          {viewing.contactId && (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <PersonAvatar name={viewing.contactName} size={42} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-muted">{t('drawer.contact')}</div>
                <Link href={`/contacts/${viewing.contactId}`} className="block truncate font-semibold hover:text-primary-soft-text">
                  {viewing.contactName}
                </Link>
              </div>
              {viewing.contactPhone && <CallButton phone={viewing.contactPhone} entityId={viewing.contactId} compact />}
            </div>
          )}
          {(viewing.dealId || viewing.listingId) && (
            <div className="flex flex-col gap-2">
              {viewing.dealId && <LinkCard href={`/deals/${viewing.dealId}`} icon={SquareKanban} tone={1} label={t('drawer.openDeal')} title={viewing.dealTitle} />}
              {viewing.listingId && <LinkCard href={`/listings/${viewing.listingId}`} icon={Building2} tone={6} label={t('drawer.openListing')} title={viewing.listingTitle} />}
            </div>
          )}
          {viewing.status === 'planned' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" icon={<CalendarCheck2 className="size-4" strokeWidth={2} aria-hidden />} loading={busy === 'done'} onClick={() => act('done', () => mutate(`/crm/viewings/${viewing.id}`, { method: 'PATCH', body: { status: 'done' } }))}>
                  {t('drawer.markDone')}
                </Button>
                <Button size="sm" variant="danger" icon={<CalendarX2 className="size-4" strokeWidth={2} aria-hidden />} loading={busy === 'cancel'} onClick={() => act('cancel', () => mutate(`/crm/viewings/${viewing.id}`, { method: 'DELETE' }))}>
                  {t('drawer.cancel')}
                </Button>
              </div>
              <form
                className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act('time', () => mutate(`/crm/viewings/${viewing.id}`, { method: 'PATCH', body: { startsAt: new Date(when).toISOString() } }));
                }}
              >
                <Field label={t('drawer.reschedule')}>
                  <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} step={300} className="tabular" />
                </Field>
                <Button type="submit" size="sm" variant="secondary" loading={busy === 'time'} className="self-start">
                  {t('drawer.saveTime')}
                </Button>
              </form>
            </>
          )}
          <Button size="sm" variant="ghost" className="self-start" icon={<RefreshCw className="size-4" strokeWidth={2} aria-hidden />} loading={busy === 'sync'} onClick={() => act('sync', () => mutate(`/crm/viewings/${viewing.id}/sync`))}>
            {t('drawer.sync')}
          </Button>
        </div>
      )}
    </Drawer>
  );
}

const STATUS_TONE_UI = { planned: 'tone-2', done: 'tone-success', cancelled: 'tone-8' } as const;
const PILL_TONE = { planned: 2, done: 'success', cancelled: 'neutral' } as const;

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-muted" aria-hidden>
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] font-medium text-muted">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

function LinkCard({ href, icon, tone, label, title }: { href: string; icon: LucideIcon; tone: Tone; label: string; title: string | null }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-border p-3 transition-all hover:border-border-strong hover:shadow-sm">
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-muted">{label}</span>
        <span className="block truncate font-semibold">{title ?? '—'}</span>
      </span>
      <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}
