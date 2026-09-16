'use client';
import { useTranslations } from 'next-intl';
import { DEAL_TYPES, type SessionUser } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Field, Input, RadioGroup, Select } from '@lokacia/ui';
import { ChipToggle, StepSection } from './parts';
import type { BusinessTypeOption, WizardForm } from './types';

export function StepType({ form, set, types, user, isEdit, errors }: { form: WizardForm; set: (p: Partial<WizardForm>) => void; types: BusinessTypeOption[]; user: SessionUser; isEdit: boolean; errors: Record<string, string> }) {
  const t = useTranslations('wizard.type');
  const f = useFormat();
  const orgs = user.orgs;
  const toggle = (slug: string) => {
    const has = form.businessTypes.includes(slug);
    set({ businessTypes: has ? form.businessTypes.filter((s) => s !== slug) : [...form.businessTypes, slug].slice(0, 5) });
  };
  return (
    <StepSection title={t('heading')}>
      <fieldset>
        <legend className="text-small font-medium">
          {t('businessTypes')} <span className="text-danger" aria-hidden>*</span>
        </legend>
        <p className="mt-1 text-small text-muted">{t('businessTypesHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {types.map((bt) => (
            <ChipToggle key={bt.slug} selected={form.businessTypes.includes(bt.slug)} disabled={!form.businessTypes.includes(bt.slug) && form.businessTypes.length >= 5} onClick={() => toggle(bt.slug)}>
              {bt.nameKa}
            </ChipToggle>
          ))}
        </div>
        {errors.businessTypes && (
          <p role="alert" className="mt-2 text-small text-danger">
            {errors.businessTypes}
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend className="text-small font-medium">{t('dealType')}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEAL_TYPES.map((d) => (
            <ChipToggle key={d} selected={form.dealType === d} onClick={() => set({ dealType: d })}>
              {f.dealType(d)}
            </ChipToggle>
          ))}
        </div>
      </fieldset>
      {!isEdit && orgs.length > 0 && (
        <Field label={t('org')}>
          <Select
            value={form.orgId ?? ''}
            onChange={(e) => set({ orgId: e.target.value || null, isOwner: e.target.value ? false : form.isOwner })}
            options={[{ value: '', label: t('personal') }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
          />
        </Field>
      )}
      {!form.orgId && (
        <fieldset>
          <legend className="mb-3 text-small font-medium">{t('who')}</legend>
          <RadioGroup
            value={form.isOwner ? 'owner' : 'broker'}
            onValueChange={(v) => set({ isOwner: v === 'owner' })}
            className="flex-row gap-6"
            options={[
              { value: 'owner', label: t('owner') },
              { value: 'broker', label: t('broker') },
            ]}
          />
        </fieldset>
      )}
      {(!form.isOwner || form.orgId) && (
        <Field label={t('commission')} className="max-w-48">
          <Input type="number" inputMode="decimal" min={0} max={100} step={0.5} value={form.commissionPct} onChange={(e) => set({ commissionPct: e.target.value })} />
        </Field>
      )}
    </StepSection>
  );
}
