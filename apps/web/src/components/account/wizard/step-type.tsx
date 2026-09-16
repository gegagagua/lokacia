'use client';
import { useTranslations } from 'next-intl';
import { Building2, CalendarClock, Handshake, KeyRound, LayoutGrid, Repeat2, Tag, UserRound, BriefcaseBusiness } from 'lucide-react';
import { DEAL_TYPES, type DealType, type SessionUser } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Field, Input, Select } from '@lokacia/ui';
import { BusinessTypeIcon } from '@/components/portal/business-type-icon';
import { GroupLabel, OptionTile, StepSection } from './parts';
import type { BusinessTypeOption, WizardForm } from './types';

const DEAL_ICONS: Record<DealType, typeof KeyRound> = { rent: KeyRound, sale: Tag, transfer: Repeat2, short_term: CalendarClock };

export function StepType({ form, set, types, user, isEdit, errors }: { form: WizardForm; set: (p: Partial<WizardForm>) => void; types: BusinessTypeOption[]; user: SessionUser; isEdit: boolean; errors: Record<string, string> }) {
  const t = useTranslations('wizard.type');
  const f = useFormat();
  const orgs = user.orgs;
  const toggle = (slug: string) => {
    const has = form.businessTypes.includes(slug);
    set({ businessTypes: has ? form.businessTypes.filter((s) => s !== slug) : [...form.businessTypes, slug].slice(0, 5) });
  };
  return (
    <StepSection title={t('heading')} icon={LayoutGrid}>
      <fieldset className="relative">
        <GroupLabel as="legend" required hint={t('businessTypesHint')}>
          {t('businessTypes')}
        </GroupLabel>
        <span className="absolute right-0 top-0 inline-flex h-7 items-center rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary-soft-text tabular" aria-hidden>
          {form.businessTypes.length} / 5
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {types.map((bt) => {
            const selected = form.businessTypes.includes(bt.slug);
            return (
              <OptionTile
                key={bt.slug}
                compact
                selected={selected}
                disabled={!selected && form.businessTypes.length >= 5}
                onClick={() => toggle(bt.slug)}
                icon={({ className }) => <BusinessTypeIcon name={bt.icon ?? ''} className={className} />}
                title={f.name(bt)}
              />
            );
          })}
        </div>
        {errors.businessTypes && (
          <p role="alert" className="mt-3 text-small font-medium text-danger">
            {errors.businessTypes}
          </p>
        )}
      </fieldset>

      <div className="h-px bg-border" aria-hidden />

      <fieldset>
        <GroupLabel as="legend">{t('dealType')}</GroupLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label={t('dealType')}>
          {DEAL_TYPES.map((d) => (
            <OptionTile key={d} role="radio" selected={form.dealType === d} onClick={() => set({ dealType: d })} icon={DEAL_ICONS[d]} title={f.dealType(d)} />
          ))}
        </div>
      </fieldset>

      {!isEdit && orgs.length > 0 && (
        <Field label={t('org')} className="max-w-md">
          <Select
            value={form.orgId ?? ''}
            onChange={(e) => set({ orgId: e.target.value || null, isOwner: e.target.value ? false : form.isOwner })}
            options={[{ value: '', label: t('personal') }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
          />
        </Field>
      )}

      {!form.orgId && (
        <fieldset>
          <GroupLabel as="legend">{t('who')}</GroupLabel>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('who')}>
            <OptionTile role="radio" selected={form.isOwner} onClick={() => set({ isOwner: true })} icon={UserRound} title={t('owner')} />
            <OptionTile role="radio" selected={!form.isOwner} onClick={() => set({ isOwner: false })} icon={Handshake} title={t('broker')} />
          </div>
        </fieldset>
      )}
      {form.orgId && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px]">
          <Building2 className="size-5 text-primary-soft-text" strokeWidth={2} aria-hidden />
          {orgs.find((o) => o.id === form.orgId)?.name}
        </div>
      )}
      {(!form.isOwner || form.orgId) && (
        <Field label={t('commission')} className="max-w-56">
          <Input type="number" inputMode="decimal" min={0} max={100} step={0.5} value={form.commissionPct} prefixIcon={<BriefcaseBusiness className="size-4" strokeWidth={2} aria-hidden />} onChange={(e) => set({ commissionPct: e.target.value })} />
        </Field>
      )}
    </StepSection>
  );
}
