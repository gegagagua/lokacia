'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Wand2 } from 'lucide-react';
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
    <Field label={t('descriptionLabel', { lang })}>
      <Textarea rows={8} maxLength={5000} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );

  return (
    <StepSection title={t('heading')}>
      <Field label={t('title')} required hint={t('titleHint')} error={errors.title}>
        <Input value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      {!form.title && (
        <Button variant="link" className="-mt-3 w-fit" icon={<Wand2 className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => set({ title: suggestTitle(form, types, titleLabels) })}>
          {t('titleSuggest')}
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" loading={busy} icon={<Sparkles className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => void generate()}>
          {t('generate')}
        </Button>
        <span className="text-small text-muted" aria-live="polite">
          {status}
        </span>
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
