'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Dialog, Field, Input, Select, useToast } from '@lokacia/ui';
import { ContactPicker, ListingPicker, MemberSelect } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { toMinor } from './types';

export function CreateDealDialog({ open, onOpenChange, initial, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: { contactId?: string | null; listingId?: string | null; stage?: string }; onCreated?: (id: string) => void }) {
  const t = useTranslations('deals');
  const router = useRouter();
  const toast = useToast();
  const mutate = useApiMutation();
  const { can, workspace } = useCrm();
  const { data: sources = [] } = useApi<{ key: string; name: string }[]>(open ? '/crm/sources' : null);
  const [contactId, setContactId] = React.useState<string | null>(initial?.contactId ?? null);
  const [listingId, setListingId] = React.useState<string | null>(initial?.listingId ?? null);
  const [title, setTitle] = React.useState('');
  const [value, setValue] = React.useState('');
  const [pct, setPct] = React.useState('10');
  const [share, setShare] = React.useState('50');
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [source, setSource] = React.useState('');
  const [stage, setStage] = React.useState(initial?.stage ?? '');
  const [expected, setExpected] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [contactLabel, setContactLabel] = React.useState('');
  const [listingLabel, setListingLabel] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setContactId(initial?.contactId ?? null);
    setListingId(initial?.listingId ?? null);
    setStage(initial?.stage ?? '');
  }, [open, initial?.contactId, initial?.listingId, initial?.stage]);

  React.useEffect(() => {
    if (!title && contactLabel) setTitle(listingLabel ? `${contactLabel} — ${listingLabel.split(',')[0]}` : contactLabel);
  }, [contactLabel, listingLabel, title]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { contactId, listingId, title, source: source || null, expectedCloseAt: expected ? new Date(`${expected}T12:00:00`).toISOString() : null };
      if (stage) body.stage = stage;
      if (agentId) body.agentId = agentId;
      if (can('finance.view')) Object.assign(body, { valueMinor: toMinor(value), commissionPct: Number(pct || 0), agentSharePct: Number(share || 0) });
      const d = await mutate<{ id: string }>('/crm/deals', { body });
      toast({ title: t('create.created'), tone: 'success' });
      onOpenChange(false);
      setTitle('');
      setValue('');
      if (onCreated) onCreated(d.id);
      else router.push(`/deals/${d.id}`);
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('create.title')} size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t('fields.contact')} required>
            <ContactPicker
              value={contactId}
              onChange={(id, label) => {
                setContactId(id);
                setContactLabel(label ?? '');
              }}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('fields.listing')}>
            <ListingPicker
              value={listingId}
              onChange={(id, l) => {
                setListingId(id);
                setListingLabel(l?.title ?? '');
                if (l && !value) setValue(String(Math.round((l.dealType === 'rent' ? l.priceMinor * 12 : l.priceMinor) / 100)));
              }}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('fields.title')} hint={t('create.titleHint')} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
          </Field>
        </div>
        {can('finance.view') && (
          <>
            <Field label={t('fields.value')}>
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="tabular" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('fields.commissionPct')}>
                <Input type="number" min={0} max={100} step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} className="tabular" />
              </Field>
              <Field label={t('fields.agentSharePct')}>
                <Input type="number" min={0} max={100} step="1" value={share} onChange={(e) => setShare(e.target.value)} className="tabular" />
              </Field>
            </div>
          </>
        )}
        <Field label={t('fields.stage')}>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} placeholder="—" options={(workspace?.pipeline?.stages ?? []).filter((s) => s.kind === 'open').map((s) => ({ value: s.key, label: s.name }))} />
        </Field>
        {can('deals.viewAll') && (
          <Field label={t('agent')}>
            <MemberSelect value={agentId} onChange={setAgentId} />
          </Field>
        )}
        <Field label={t('fields.source')}>
          <Select value={source} onChange={(e) => setSource(e.target.value)} placeholder="—" options={sources.map((s) => ({ value: s.key, label: s.name }))} />
        </Field>
        <Field label={t('fields.expectedCloseAt')}>
          <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="submit" loading={busy} disabled={!contactId || !title.trim()}>
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
