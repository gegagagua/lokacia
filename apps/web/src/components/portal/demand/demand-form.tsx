'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DEAL_TYPES, type DemandDto } from '@lokacia/contracts';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';
import { useFormat } from '@/i18n/use-format';

type Group = { city: string; name: string; districts: { id: string; name: string }[] };

export function DemandForm({ types, groups, defaultPhone }: { types: { value: string; label: string }[]; groups: Group[]; defaultPhone: string }) {
  const t = useTranslations('demand.form');
  const router = useRouter();
  const lp = useLocalizedPath();
  const f = useFormat();
  const [v, setV] = React.useState({ businessType: '', dealType: 'rent', title: '', description: '', areaMin: '', areaMax: '', budget: '', contactPhone: defaultPhone, expiresInDays: '30' });
  const [districtIds, setDistrictIds] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const int = (s: string) => (s.trim() === '' ? null : Math.round(Number(s)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await apiFetch<DemandDto>('/demand', {
        method: 'POST',
        body: {
          businessType: v.businessType,
          dealType: v.dealType,
          title: v.title,
          description: v.description || null,
          areaMin: int(v.areaMin),
          areaMax: int(v.areaMax),
          budgetMinor: v.budget.trim() === '' ? null : Math.round(Number(v.budget) * 100),
          districtIds,
          contactPhone: v.contactPhone || null,
          expiresInDays: Number(v.expiresInDays),
        },
      });
      router.push(lp(`/demand/${res.id}`));
    } catch (err) {
      const p = err instanceof ClientApiError ? err.problem : null;
      if (p?.errors?.length) setErrors(Object.fromEntries(p.errors.map((x) => [x.path.split('.')[0]!, x.message])));
      setFormError(p?.detail ?? p?.title ?? t('error'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card flex min-w-0 flex-col gap-5 p-5 md:p-7" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('businessType')} required error={errors.businessType}>
          <Select value={v.businessType} onChange={set('businessType')} placeholder={t('choose')} options={types} required />
        </Field>
        <Field label={t('dealType')} error={errors.dealType}>
          <Select value={v.dealType} onChange={set('dealType')} options={DEAL_TYPES.map((d) => ({ value: d, label: f.dealType(d) }))} />
        </Field>
      </div>
      <Field label={t('titleLabel')} required error={errors.title}>
        <Input value={v.title} onChange={set('title')} placeholder={t('titlePlaceholder')} maxLength={140} required />
      </Field>
      <Field label={t('description')} error={errors.description}>
        <Textarea value={v.description} onChange={set('description')} placeholder={t('descriptionPlaceholder')} maxLength={2000} rows={4} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('areaMin')} error={errors.areaMin}>
          <Input type="number" inputMode="numeric" min={1} value={v.areaMin} onChange={set('areaMin')} suffix={f.areaUnit} />
        </Field>
        <Field label={t('areaMax')} error={errors.areaMax}>
          <Input type="number" inputMode="numeric" min={1} value={v.areaMax} onChange={set('areaMax')} suffix={f.areaUnit} />
        </Field>
        <Field label={t('budget')} hint={t('budgetHint')} error={errors.budgetMinor}>
          <Input type="number" inputMode="numeric" min={0} value={v.budget} onChange={set('budget')} suffix="₾" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-small font-medium">{t('districts')}</legend>
        <p className="-mt-1 text-small text-muted">{t('districtsHint')}</p>
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface-2 p-4">
          {groups.map((g) => (
            <div key={g.city} className="mb-3 last:mb-0">
              <p className="mb-2 text-small font-semibold text-muted">{g.name}</p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {g.districts.map((d) => (
                  <Checkbox
                    key={d.id}
                    label={d.name}
                    checked={districtIds.includes(d.id)}
                    onCheckedChange={(on) => setDistrictIds((s) => (on === true ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('phone')} hint={t('phoneHint')} error={errors.contactPhone}>
          <Input type="tel" inputMode="tel" value={v.contactPhone} onChange={set('contactPhone')} autoComplete="tel" />
        </Field>
        <Field label={t('expires')} error={errors.expiresInDays}>
          <Select value={v.expiresInDays} onChange={set('expiresInDays')} options={['7', '14', '30', '60'].map((d) => ({ value: d, label: t('days', { count: d }) }))} />
        </Field>
      </div>
      <div aria-live="polite">{formError && <p className="text-small text-danger">{formError}</p>}</div>
      <Button type="submit" size="lg" loading={saving} disabled={!v.businessType || v.title.trim().length < 5} className="self-start">
        {t('submit')}
      </Button>
    </form>
  );
}
