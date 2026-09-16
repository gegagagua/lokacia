'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Briefcase } from 'lucide-react';
import { Field, Input, Select, Textarea } from '@lokacia/ui';

export type TenantProfileValue = {
  activity?: string | null;
  businessType?: string | null;
  companyName?: string | null;
  experienceYears?: number | null;
  desiredTermMonths?: number | null;
  employees?: number | null;
  website?: string | null;
  about?: string | null;
};

export type BusinessTypeOption = { slug: string; nameKa: string };

/** P20: compact read-only tenant profile card (attached to offers and viewing requests). */
export function TenantProfileSummary({ profile, name, businessTypes = [], action, className }: { profile: TenantProfileValue | null; name?: string | null; businessTypes?: BusinessTypeOption[]; action?: React.ReactNode; className?: string }) {
  const t = useTranslations('offers.tenant');
  const bt = businessTypes.find((b) => b.slug === profile?.businessType)?.nameKa;
  const facts = profile
    ? [
        profile.companyName,
        profile.activity,
        bt,
        profile.experienceYears != null ? t('experience', { years: profile.experienceYears }) : null,
        profile.desiredTermMonths != null ? t('desiredTerm', { months: profile.desiredTermMonths }) : null,
        profile.employees != null ? t('employees', { count: profile.employees }) : null,
      ].filter(Boolean)
    : [];
  return (
    <div className={`card p-5 ${className ?? ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-link/12 text-link" aria-hidden>
            <Briefcase className="size-5" strokeWidth={2} />
          </span>
          <span className="font-bold leading-snug">{name ? t('titleFor', { name }) : t('title')}</span>
        </div>
        {action}
      </div>
      {facts.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {facts.map((x, i) => (
            <li key={i} className="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 py-0.5 text-[13.5px] font-medium">
              {x}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-border-strong px-4 py-3 text-small text-muted">{t('empty')}</p>
      )}
      {profile?.about && <p className="mt-3 whitespace-pre-wrap text-small text-muted">{profile.about}</p>}
      {profile?.website && (
        <a href={profile.website} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-small font-medium text-link underline-offset-4 hover:underline">
          {profile.website}
        </a>
      )}
    </div>
  );
}

const num = (v: string) => (v === '' ? null : Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);

/** Inline editor; parent keeps the value and sends it as `tenantProfile`. */
export function TenantProfileEditor({ value, onChange, businessTypes }: { value: TenantProfileValue; onChange: (v: TenantProfileValue) => void; businessTypes: BusinessTypeOption[] }) {
  const t = useTranslations('offers.tenant');
  const set = (patch: Partial<TenantProfileValue>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('companyName')}>
        <Input value={value.companyName ?? ''} maxLength={120} onChange={(e) => set({ companyName: e.target.value || null })} />
      </Field>
      <Field label={t('activity')} hint={t('activityHint')}>
        <Input value={value.activity ?? ''} maxLength={200} onChange={(e) => set({ activity: e.target.value || null })} />
      </Field>
      <Field label={t('businessType')}>
        <Select value={value.businessType ?? ''} placeholder={t('choose')} options={[{ value: '', label: t('choose') }, ...businessTypes.map((b) => ({ value: b.slug, label: b.nameKa }))]} onChange={(e) => set({ businessType: e.target.value || null })} />
      </Field>
      <Field label={t('experienceYears')}>
        <Input type="number" inputMode="numeric" min={0} max={80} value={value.experienceYears ?? ''} onChange={(e) => set({ experienceYears: num(e.target.value) })} />
      </Field>
      <Field label={t('desiredTermMonths')}>
        <Input type="number" inputMode="numeric" min={1} max={240} value={value.desiredTermMonths ?? ''} onChange={(e) => set({ desiredTermMonths: num(e.target.value) || null })} />
      </Field>
      <Field label={t('employeesLabel')}>
        <Input type="number" inputMode="numeric" min={0} value={value.employees ?? ''} onChange={(e) => set({ employees: num(e.target.value) })} />
      </Field>
      <Field label={t('website')} className="sm:col-span-2">
        <Input type="url" placeholder="https://" value={value.website ?? ''} onChange={(e) => set({ website: e.target.value || null })} />
      </Field>
      <Field label={t('about')} className="sm:col-span-2">
        <Textarea value={value.about ?? ''} maxLength={2000} onChange={(e) => set({ about: e.target.value || null })} />
      </Field>
    </div>
  );
}

/** Strip server-only fields and invalid URL before sending to the API. */
export function cleanTenantProfile(v: TenantProfileValue): TenantProfileValue {
  const website = v.website && /^https?:\/\/.+\..+/.test(v.website) ? v.website : null;
  return {
    activity: v.activity ?? null,
    businessType: v.businessType ?? null,
    companyName: v.companyName ?? null,
    experienceYears: v.experienceYears ?? null,
    desiredTermMonths: v.desiredTermMonths ?? null,
    employees: v.employees ?? null,
    website,
    about: v.about ?? null,
  };
}
