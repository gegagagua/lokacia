'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarCheck2, CalendarX2, MapPin, RefreshCw } from 'lucide-react';
import { formatDateTimeKa, type CrmViewing } from '@lokacia/contracts';
import { Badge, Button, Drawer, Field, Input, SpecRow, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';
import { timeHM, toLocalInput } from './dates';

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

  return (
    <Drawer open={!!viewing} onOpenChange={onOpenChange} title={viewing?.title ?? t('drawer.title')}>
      {viewing && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[viewing.status]}>{t(`status.${viewing.status}`)}</Badge>
            {viewing.routeOrder && <Badge tone="link">№ {viewing.routeOrder}</Badge>}
          </div>
          <div>
            <SpecRow label={t('drawer.when')} value={`${formatDateTimeKa(viewing.startsAt)}–${timeHM(viewing.endsAt)}`} />
            {viewing.address && <SpecRow label={t('drawer.address')} value={viewing.address} />}
            {viewing.agentName && <SpecRow label={t('drawer.agent')} value={viewing.agentName} />}
            <SpecRow label={t('drawer.google')} value={viewing.googleEventId ? t('drawer.synced') : t('drawer.notSynced')} muted={!viewing.googleEventId} />
          </div>
          {viewing.contactId && (
            <div className="flex flex-col gap-2 rounded-card border border-border p-3">
              <div className="text-small text-muted">{t('drawer.contact')}</div>
              <Link href={`/contacts/${viewing.contactId}`} className="font-medium text-link hover:underline">
                {viewing.contactName}
              </Link>
              {viewing.contactPhone && <CallButton phone={viewing.contactPhone} entityId={viewing.contactId} className="self-start" />}
            </div>
          )}
          <div className="flex flex-col gap-1 text-[14px]">
            {viewing.dealId && (
              <Link href={`/deals/${viewing.dealId}`} className="text-link hover:underline">
                {t('drawer.openDeal')}: {viewing.dealTitle}
              </Link>
            )}
            {viewing.listingId && (
              <Link href={`/listings/${viewing.listingId}`} className="text-link hover:underline">
                {t('drawer.openListing')}: {viewing.listingTitle}
              </Link>
            )}
            {viewing.lat != null && viewing.lng != null && (
              <a href={`https://www.openstreetmap.org/?mlat=${viewing.lat}&mlon=${viewing.lng}#map=17/${viewing.lat}/${viewing.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden /> OpenStreetMap
              </a>
            )}
          </div>
          {viewing.status === 'planned' && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<CalendarCheck2 className="size-4" strokeWidth={1.5} aria-hidden />} loading={busy === 'done'} onClick={() => act('done', () => mutate(`/crm/viewings/${viewing.id}`, { method: 'PATCH', body: { status: 'done' } }))}>
                  {t('drawer.markDone')}
                </Button>
                <Button size="sm" variant="danger" icon={<CalendarX2 className="size-4" strokeWidth={1.5} aria-hidden />} loading={busy === 'cancel'} onClick={() => act('cancel', () => mutate(`/crm/viewings/${viewing.id}`, { method: 'DELETE' }))}>
                  {t('drawer.cancel')}
                </Button>
              </div>
              <form
                className="flex flex-col gap-2 rounded-card border border-border p-3"
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
          <Button size="sm" variant="ghost" className="self-start" icon={<RefreshCw className="size-4" strokeWidth={1.5} aria-hidden />} loading={busy === 'sync'} onClick={() => act('sync', () => mutate(`/crm/viewings/${viewing.id}/sync`))}>
            {t('drawer.sync')}
          </Button>
        </div>
      )}
    </Drawer>
  );
}
