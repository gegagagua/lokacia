'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList, ListFilter, TriangleAlert } from 'lucide-react';
import { PASSPORT_FIELD_BY_KEY, PASSPORT_KEYS, type PassportKey } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Field, Input } from '@lokacia/ui';
import { StepSection, TriState } from './parts';
import { relevantKeys, requiredKeys, type BusinessTypeOption, type WizardForm } from './types';

export function StepPassport({ form, update, types, errors }: { form: WizardForm; update: (fn: (f: WizardForm) => Partial<WizardForm>) => void; types: BusinessTypeOption[]; errors: Record<string, string> }) {
  const t = useTranslations('wizard.passport');
  const f = useFormat();
  const [all, setAll] = React.useState(false);
  const required = new Set(requiredKeys(form, types));
  const relevant = relevantKeys(form, types);
  const keys: PassportKey[] = all ? [...PASSPORT_KEYS] : [...relevant, ...PASSPORT_KEYS.filter((k) => !relevant.includes(k) && form.passport[k] != null)];
  const setKey = (k: PassportKey, v: boolean | number | null) => update((x) => ({ passport: { ...x.passport, [k]: v } }));
  const filled = relevant.filter((k) => form.passport[k] != null).length;
  const pct = relevant.length ? Math.round((filled / relevant.length) * 100) : 100;
  const numeric = keys.filter((k) => PASSPORT_FIELD_BY_KEY[k].kind !== 'boolean');
  const booleans = keys.filter((k) => PASSPORT_FIELD_BY_KEY[k].kind === 'boolean');

  return (
    <StepSection
      title={t('heading')}
      hint={t('hint')}
      icon={ClipboardList}
      action={
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <span className="text-[13px] font-semibold tabular text-muted">{pct}%</span>
          <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('heading')}>
            <span className={`block h-full rounded-full transition-all duration-300 ${pct >= 70 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
          </span>
        </div>
      }
    >
      {errors.passport && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-small font-medium text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          {errors.passport}
        </p>
      )}
      {numeric.length > 0 && (
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {numeric.map((k) => {
            const meta = PASSPORT_FIELD_BY_KEY[k];
            const unit = f.unit(meta.unit);
            return (
              <Field key={k} label={f.passport(k)} required={required.has(k)} error={errors[`passport.${k}`]}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={meta.kind === 'integer' ? 1 : 0.1}
                  suffix={unit || undefined}
                  value={form.passport[k] == null ? '' : String(form.passport[k])}
                  onChange={(e) => {
                    const raw = e.target.value.replace(',', '.');
                    const n = Number(raw);
                    setKey(k, raw === '' || !Number.isFinite(n) ? null : meta.kind === 'integer' ? Math.round(n) : n);
                  }}
                />
              </Field>
            );
          })}
        </div>
      )}
      {booleans.length > 0 && (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {booleans.map((k) => {
            const err = errors[`passport.${k}`];
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border py-3">
                <span id={`pp-${k}-label`} className="text-[15px] font-medium">
                  {f.passport(k)}
                  {required.has(k) && (
                    <span className="text-danger" aria-label={t('required')}>
                      {' '}
                      *
                    </span>
                  )}
                </span>
                <TriState value={form.passport[k] as boolean | null | undefined} onChange={(v) => setKey(k, v)} yes={t('yes')} no={t('no')} invalid={!!err} describedBy={`pp-${k}-label`} />
                {err && (
                  <p role="alert" className="w-full text-small text-danger">
                    {err}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="secondary" size="sm" className="w-fit" icon={<ListFilter className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setAll((v) => !v)}>
        {all ? t('showRelevant') : t('showAll')}
      </Button>
    </StepSection>
  );
}
