'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ClipboardList } from 'lucide-react';
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
      className="card flex flex-col gap-5 p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tone-soft text-tone-ink tone-3" aria-hidden>
          <ClipboardList className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-[18px] font-semibold leading-6">{t('title')}</h2>
          <p className="text-[13.5px] text-muted">{t('hint')}</p>
        </div>
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
        <legend className="mb-2.5 text-[14px] font-semibold">{t('districts')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {districts.map((d) => {
            const on = form.districtIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => set('districtIds', on ? form.districtIds.filter((x) => x !== d.id) : [...form.districtIds, d.id])}
                className={cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13.5px] font-medium transition-all duration-200', on ? 'border-transparent bg-primary text-primary-contrast shadow-sm' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text')}
              >
                {on && <Check className="size-3.5" strokeWidth={2.4} aria-hidden />}
                {d.nameKa}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label={t('notes')}>
        <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-16" />
      </Field>
      <div className="-mx-4 -mb-4 flex flex-wrap justify-end gap-2 rounded-b-card border-t border-border bg-surface-2/50 px-4 py-3 md:-mx-6 md:-mb-6 md:px-6">
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
