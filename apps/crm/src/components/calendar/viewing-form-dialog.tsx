'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CrmViewing } from '@lokacia/contracts';
import { Button, Dialog, Field, Input, useToast } from '@lokacia/ui';
import { ContactPicker, ListingPicker, MemberSelect } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';
import { dayKey, localToIso } from './dates';

export type ViewingPrefill = { dealId?: string | null; contactId?: string | null; listingId?: string | null; date?: string };

export function ViewingFormDialog({ open, onOpenChange, prefill, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: ViewingPrefill; onCreated?: (v: CrmViewing) => void }) {
  const t = useTranslations('calendar');
  const toast = useToast();
  const mutate = useApiMutation();
  const { can, user } = useCrm();
  const [contactId, setContactId] = React.useState<string | null>(prefill?.contactId ?? null);
  const [listingId, setListingId] = React.useState<string | null>(prefill?.listingId ?? null);
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(prefill?.date ?? dayKey(new Date()));
  const [time, setTime] = React.useState('11:00');
  const [duration, setDuration] = React.useState('45');
  const [address, setAddress] = React.useState('');
  const [agentId, setAgentId] = React.useState<string | null>(user.id);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setContactId(prefill?.contactId ?? null);
    setListingId(prefill?.listingId ?? null);
    if (prefill?.date) setDate(prefill.date);
  }, [open, prefill?.contactId, prefill?.listingId, prefill?.date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const v = await mutate<CrmViewing>('/crm/viewings', {
        body: {
          title: title || null,
          contactId,
          listingId,
          dealId: prefill?.dealId ?? null,
          agentId: can('deals.viewAll') ? agentId : undefined,
          startsAt: localToIso(date, time),
          durationMin: Number(duration) || 45,
          address: address || null,
        },
      });
      toast({ title: t('form.created'), tone: 'success' });
      onOpenChange(false);
      setTitle('');
      setAddress('');
      onCreated?.(v);
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('new')}
      description={prefill?.dealId ? t('form.fromDeal') : undefined}
      size="lg"
      footer={
        <Button type="submit" form="viewing-form" loading={busy}>
          {t('form.create')}
        </Button>
      }
    >
      <form id="viewing-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-small font-medium">{t('form.listing')}</span>
          <ListingPicker value={listingId} onChange={(id) => setListingId(id)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-small font-medium">{t('form.contact')}</span>
          <ContactPicker value={contactId} onChange={(id) => setContactId(id)} />
        </div>
        <Field label={t('form.date')} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="tabular" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('form.time')} required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required step={300} className="tabular" />
          </Field>
          <Field label={t('form.duration')}>
            <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="tabular" />
          </Field>
        </div>
        <Field label={t('form.title')} hint={t('form.titleHint')} className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label={t('form.address')} hint={t('form.addressHint')} className="sm:col-span-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
        </Field>
        {can('deals.viewAll') && (
          <Field label={t('form.agent')}>
            <MemberSelect value={agentId} onChange={setAgentId} includeEmpty={false} />
          </Field>
        )}
      </form>
    </Dialog>
  );
}
