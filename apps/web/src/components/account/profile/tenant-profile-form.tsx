'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { TenantProfile } from '@lokacia/contracts';
import { Briefcase } from 'lucide-react';
import { Button, Field, Input, Select, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** P20 tenant profile editor (also embedded in the offer form by the offers UI). */
export function TenantProfileForm({ initial, businessTypes, onSaved, compact }: { initial: TenantProfile | null; businessTypes: { value: string; label: string }[]; onSaved?: (p: TenantProfile) => void; compact?: boolean }) {
  const t = useTranslations('account.profile');
  const toast = useToast();
  const [f, setF] = React.useState({
    activity: initial?.activity ?? '',
    companyName: initial?.companyName ?? '',
    businessType: initial?.businessType ?? '',
    experienceYears: initial?.experienceYears?.toString() ?? '',
    desiredTermMonths: initial?.desiredTermMonths?.toString() ?? '',
    employees: initial?.employees?.toString() ?? '',
    website: initial?.website ?? '',
    about: initial?.about ?? '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const website = f.website.trim();
    if (website && !/^https?:\/\/\S+\.\S+/.test(website)) {
      setErrors({ website: t('websiteError') });
      return;
    }
    const body: TenantProfile = {
      activity: f.activity.trim() || null,
      companyName: f.companyName.trim() || null,
      businessType: f.businessType || null,
      experienceYears: num(f.experienceYears),
      desiredTermMonths: num(f.desiredTermMonths),
      employees: num(f.employees),
      website: website || null,
      about: f.about.trim() || null,
    };
    setBusy(true);
    setErrors({});
    try {
      await apiFetch('/users/me/tenant-profile', { method: 'PUT', body });
      toast({ title: t('saved'), tone: 'success' });
      onSaved?.(body);
    } catch (err) {
      if (err instanceof ClientApiError && err.problem?.errors) setErrors(Object.fromEntries(err.problem.errors.map((x) => [x.path, x.message])));
      toast({ title: err instanceof ClientApiError ? err.message : t('saveError'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? 'flex flex-col gap-3' : 'card flex flex-col gap-5 p-5 sm:p-7'}>
      {!compact && (
        <div className="flex items-start gap-4 rounded-2xl bg-link/[0.07] p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-link/12 text-link" aria-hidden>
            <Briefcase className="size-5" strokeWidth={2} />
          </span>
          <p className="text-[15px]">{t('tenantIntro')}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('activity')} error={errors.activity}>
          <Input value={f.activity} onChange={set('activity')} placeholder={t('activityPlaceholder')} maxLength={200} />
        </Field>
        <Field label={t('companyName')} error={errors.companyName}>
          <Input value={f.companyName} onChange={set('companyName')} maxLength={120} autoComplete="organization" />
        </Field>
        <Field label={t('businessType')}>
          <Select value={f.businessType} onChange={set('businessType')} options={businessTypes} placeholder={t('businessTypeNone')} />
        </Field>
        <Field label={t('experienceYears')} error={errors.experienceYears}>
          <Input type="number" inputMode="numeric" min={0} max={80} value={f.experienceYears} onChange={set('experienceYears')} />
        </Field>
        <Field label={t('desiredTermMonths')} error={errors.desiredTermMonths}>
          <Input type="number" inputMode="numeric" min={1} max={240} value={f.desiredTermMonths} onChange={set('desiredTermMonths')} />
        </Field>
        <Field label={t('employees')} error={errors.employees}>
          <Input type="number" inputMode="numeric" min={0} value={f.employees} onChange={set('employees')} />
        </Field>
      </div>
      <Field label={t('website')} error={errors.website}>
        <Input type="url" value={f.website} onChange={set('website')} placeholder="https://" />
      </Field>
      <Field label={t('about')} error={errors.about}>
        <Textarea value={f.about} onChange={set('about')} maxLength={2000} rows={compact ? 3 : 4} />
      </Field>
      <div className={compact ? '' : 'flex justify-end border-t border-border pt-5'}>
        <Button type="submit" loading={busy} variant={compact ? 'secondary' : 'primary'}>
          {t('saveTenant')}
        </Button>
      </div>
    </form>
  );
}
