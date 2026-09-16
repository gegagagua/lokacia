'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PenLine, Sparkles, Wand2 } from 'lucide-react';
import type { DescribeResponse } from '@lokacia/contracts';
import { Button, Field, Input, Tabs, Textarea, useToast } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { StepSection } from './parts';
import { money, parseNum, suggestTitle, type BusinessTypeOption, type WizardForm } from './types';
import { useFormat } from '@/i18n/use-format';

export function StepDescribe({ form, set, types, errors }: { form: WizardForm; set: (p: Partial<WizardForm>) => void; types: BusinessTypeOption[]; errors: Record<string, string> }) {
  const t = useTranslations('wizard.describe');
  const fmt = useFormat();
  const titleLabels = { fallback: t('defaultTitle'), areaUnit: fmt.areaUnit };
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState('');

  const generate = async () => {
    setBusy(true);
    setStatus(t('generating'));
    try {
      const passport = Object.fromEntries(Object.entries(form.passport).filter(([, v]) => v !== null && v !== undefined));
      const r = await apiFetch<DescribeResponse>('/ai/describe', {
        method: 'POST',
        body: { facts: { title: form.title || suggestTitle(form, types, titleLabels), businessTypes: form.businessTypes, dealType: form.dealType, areaM2: parseNum(form.areaM2) ?? 1, floor: parseNum(form.floor), address: form.address, districtId: form.districtId, lat: form.lat, lng: form.lng, priceMinor: money(form.price) ?? 0, passport } },
      });
      set({ description: r.ka, descriptionEn: r.en, descriptionRu: r.ru });
      setStatus(r.source === 'ai' ? t('generated') : t('generatedTemplate'));
    } catch {
      setStatus('');
      toast({ title: t('generateError'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const area = (key: 'description' | 'descriptionEn' | 'descriptionRu', lang: string) => (
    <Field label={t('descriptionLabel', { lang })} hint={`${form[key].length} / 5000`}>
      <Textarea rows={9} maxLength={5000} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );

  return (
    <StepSection title={t('heading')} icon={PenLine}>
      <div className="flex flex-col gap-2">
        <Field label={t('title')} required hint={t('titleHint')} error={errors.title}>
          <Input value={form.title} maxLength={120} className="text-[17px] font-semibold" onChange={(e) => set({ title: e.target.value })} />
        </Field>
        {!form.title && (
          <Button variant="secondary" size="sm" className="w-fit" icon={<Wand2 className="size-4" strokeWidth={2} aria-hidden />} onClick={() => set({ title: suggestTitle(form, types, titleLabels) })}>
            {t('titleSuggest')}
          </Button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-card border border-primary/20 bg-[linear-gradient(135deg,var(--primary-soft),var(--surface)_55%,var(--accent-soft))] p-5 sm:p-6">
        <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-contrast shadow-md" aria-hidden>
            <Sparkles className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold">{t('aiTitle')}</div>
            <p className="text-small text-muted">{t('aiHint')}</p>
          </div>
          <Button variant="accent" loading={busy} icon={<Sparkles className="size-4" strokeWidth={2} aria-hidden />} onClick={() => void generate()} className="self-start sm:self-auto">
            {t('generate')}
          </Button>
        </div>
        <div aria-live="polite" className="relative">
          {status && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-small font-medium shadow-xs">
              <span className={busy ? 'size-2 animate-pulse rounded-full bg-accent' : 'size-2 rounded-full bg-success'} aria-hidden />
              {status}
            </p>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'ka', label: t('descriptionKa'), content: area('description', t('descriptionKa')) },
          { value: 'en', label: t('descriptionEn'), content: area('descriptionEn', t('descriptionEn')) },
          { value: 'ru', label: t('descriptionRu'), content: area('descriptionRu', t('descriptionRu')) },
        ]}
      />
    </StepSection>
  );
}
