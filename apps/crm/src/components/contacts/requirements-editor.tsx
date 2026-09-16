'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BUSINESS_TYPES, DEAL_TYPE_LABELS_KA, DEAL_TYPES } from '@lokacia/contracts';
import { Button, cn, Field, Input, Select, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';
import type { ContactRequirements } from '@/lib/types';
import type { District } from './types';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(/\s/g, '').replace(',', '.')));

/** C2: client requirements; saving re-runs matching on the server. */
export function RequirementsEditor({ contactId, value, onSaved }: { contactId: string; value: ContactRequirements | null; onSaved: () => void }) {
  const t = useTranslations('contacts.requirements');
  const toast = useToast();
  const mutate = useApiMutation();
  const { data: districts = [] } = useApi<District[]>('/taxonomy/districts?city=tbilisi');
  const [form, setForm] = React.useState(() => ({
    businessType: value?.businessType ?? '',
    dealType: value?.dealType ?? '',
    areaMin: value?.areaMin != null ? String(value.areaMin) : '',
    areaMax: value?.areaMax != null ? String(value.areaMax) : '',
    budget: value?.budgetMaxMinor != null ? String(Math.round(value.budgetMaxMinor / 100)) : '',
    districtIds: value?.districtIds ?? [],
    notes: value?.notes ?? '',
  }));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (clear = false) => {
    setBusy(true);
    const b = num(form.budget);
    const requirements = clear
      ? null
      : Object.fromEntries(
          Object.entries({
            businessType: form.businessType || undefined,
            dealType: form.dealType || undefined,
            areaMin: num(form.areaMin),
            areaMax: num(form.areaMax),
            budgetMaxMinor: b !== undefined ? Math.round(b * 100) : undefined,
            districtIds: form.districtIds.length ? form.districtIds : undefined,
            notes: form.notes.trim() || undefined,
          }).filter(([, v]) => v !== undefined),
        );
    try {
      await mutate(`/crm/contacts/${contactId}`, { method: 'PATCH', body: { requirements } });
      toast({ title: t('saved'), tone: 'success' });
      onSaved();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <h2 className="text-h3 font-semibold">{t('title')}</h2>
        <p className="text-small text-muted">{t('hint')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('businessType')}>
          <Select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} placeholder={t('any')} options={BUSINESS_TYPES.map((b) => ({ value: b.slug, label: b.nameKa }))} />
        </Field>
        <Field label={t('dealType')}>
          <Select value={form.dealType} onChange={(e) => set('dealType', e.target.value as typeof form.dealType)} placeholder={t('any')} options={DEAL_TYPES.map((d) => ({ value: d, label: DEAL_TYPE_LABELS_KA[d] }))} />
        </Field>
        <Field label={t('areaMin')}>
          <Input inputMode="decimal" value={form.areaMin} onChange={(e) => set('areaMin', e.target.value)} className="tabular" suffix="მ²" />
        </Field>
        <Field label={t('areaMax')}>
          <Input inputMode="decimal" value={form.areaMax} onChange={(e) => set('areaMax', e.target.value)} className="tabular" suffix="მ²" />
        </Field>
        <Field label={t('budget')} hint={t('budgetHint')}>
          <Input inputMode="numeric" value={form.budget} onChange={(e) => set('budget', e.target.value)} className="tabular" suffix="₾" />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-small font-medium">{t('districts')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {districts.map((d) => {
            const on = form.districtIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => set('districtIds', on ? form.districtIds.filter((x) => x !== d.id) : [...form.districtIds, d.id])}
                className={cn('h-8 rounded-button border px-2.5 text-small transition-colors duration-150', on ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:bg-surface-2')}
              >
                {d.nameKa}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label={t('notes')}>
        <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-16" />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {value && (
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>
            {t('clear')}
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
