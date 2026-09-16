'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CONTACT_TYPES } from '@lokacia/contracts';
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from '@lokacia/ui';
import { MemberSelect } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import type { ContactDetail, ContactFacets } from './types';

const lines = (s: string) =>
  s
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Create / edit contact. On create, an empty agent means automatic lead distribution. */
export function ContactFormDialog({ open, onOpenChange, contact, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; contact?: ContactDetail | null; onSaved: (c: { id: string }) => void }) {
  const t = useTranslations('contacts');
  const toast = useToast();
  const mutate = useApiMutation();
  const { role, user } = useCrm();
  const userId = user.id;
  const { data: facets } = useApi<ContactFacets>(open ? '/crm/contacts/facets' : null);
  const [form, setForm] = React.useState(() => ({
    name: contact?.name ?? '',
    company: contact?.company ?? '',
    type: contact?.type ?? 'client',
    phones: contact?.phones.join('\n') ?? '',
    emails: contact?.emails.join('\n') ?? '',
    tags: contact?.tags.join(', ') ?? '',
    source: contact?.source ?? '',
    ownerAgentId: contact?.ownerAgentId ?? (role === 'agent' ? userId : null),
    notes: contact?.notes ?? '',
  }));
  const [busy, setBusy] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const body = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      type: form.type,
      phones: lines(form.phones),
      emails: lines(form.emails),
      tags: lines(form.tags),
      source: form.source || null,
      ownerAgentId: form.ownerAgentId,
      notes: form.notes.trim() || null,
    };
    try {
      const saved = contact ? await mutate<{ id: string }>(`/crm/contacts/${contact.id}`, { method: 'PATCH', body }) : await mutate<{ id: string }>('/crm/contacts', { body });
      toast({ title: contact ? t('form.saved') : t('form.created'), tone: 'success' });
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      const problem = (err as { problem?: { errors?: { path: string; message: string }[] } }).problem;
      if (problem?.errors?.length) setErrors(Object.fromEntries(problem.errors.map((x) => [x.path.split('.')[0]!, x.message])));
      toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={contact ? t('form.editTitle') : t('form.createTitle')}
      size="lg"
      footer={
        <Button type="submit" form="contact-form" loading={busy}>
          {contact ? t('form.save') : t('form.create')}
        </Button>
      }
    >
      <form id="contact-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.name')} required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
        </Field>
        <Field label={t('form.type')}>
          <Select value={form.type} onChange={(e) => set('type', e.target.value as typeof form.type)} options={CONTACT_TYPES.map((x) => ({ value: x, label: t(`types.${x}`) }))} />
        </Field>
        <Field label={t('form.company')}>
          <Input value={form.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label={t('form.phones')} hint={t('form.phonesHint')} error={errors.phones}>
          <Textarea value={form.phones} onChange={(e) => set('phones', e.target.value)} className="min-h-20 tabular" inputMode="tel" />
        </Field>
        <Field label={t('form.emails')} hint={t('form.emailsHint')} error={errors.emails}>
          <Textarea value={form.emails} onChange={(e) => set('emails', e.target.value)} className="min-h-20" inputMode="email" />
        </Field>
        <Field label={t('form.tags')} hint={t('form.tagsHint')}>
          <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} list="contact-tags" />
        </Field>
        <datalist id="contact-tags">{facets?.tags.map((x) => <option key={x.tag} value={x.tag} />)}</datalist>
        <Field label={t('form.source')}>
          <Select value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="—" options={(facets?.sources ?? []).map((s) => ({ value: s.key, label: s.name }))} />
        </Field>
        {role !== 'agent' && (
          <Field label={t('form.agent')} className="sm:col-span-2">
            <MemberSelect value={form.ownerAgentId} onChange={(v) => set('ownerAgentId', v)} placeholder={contact ? '—' : t('form.autoAssign')} />
          </Field>
        )}
        <Field label={t('form.notes')} className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
