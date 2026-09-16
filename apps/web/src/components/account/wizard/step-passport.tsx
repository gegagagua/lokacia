'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PASSPORT_FIELD_BY_KEY, PASSPORT_KEYS, type PassportKey } from '@lokacia/contracts';
import { Button, Field, Input } from '@lokacia/ui';
import { StepSection, TriState } from './parts';
import { relevantKeys, requiredKeys, type BusinessTypeOption, type WizardForm } from './types';

export function StepPassport({ form, update, types, errors }: { form: WizardForm; update: (fn: (f: WizardForm) => Partial<WizardForm>) => void; types: BusinessTypeOption[]; errors: Record<string, string> }) {
  const t = useTranslations('wizard.passport');
  const [all, setAll] = React.useState(false);
  const required = new Set(requiredKeys(form, types));
  const relevant = relevantKeys(form, types);
  const keys: PassportKey[] = all ? [...PASSPORT_KEYS] : [...relevant, ...PASSPORT_KEYS.filter((k) => !relevant.includes(k) && form.passport[k] != null)];
  const setKey = (k: PassportKey, v: boolean | number | null) => update((f) => ({ passport: { ...f.passport, [k]: v } }));

  return (
    <StepSection title={t('heading')} hint={t('hint')}>
      {errors.passport && (
        <p role="alert" className="rounded-button border border-danger px-3 py-2 text-small text-danger">
          {errors.passport}
        </p>
      )}
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {keys.map((k) => {
          const meta = PASSPORT_FIELD_BY_KEY[k];
          const err = errors[`passport.${k}`];
          const label = `${meta.labelKa}${meta.unit ? `, ${meta.unit}` : ''}`;
          if (meta.kind === 'boolean') {
            return (
              <div key={k} className="flex flex-col gap-1.5">
                <span id={`pp-${k}-label`} className="text-small font-medium">
                  {label}
                  {required.has(k) && <span className="text-danger" aria-label={t('required')}> *</span>}
                </span>
                <TriState value={form.passport[k] as boolean | null | undefined} onChange={(v) => setKey(k, v)} yes={t('yes')} no={t('no')} invalid={!!err} describedBy={`pp-${k}-label`} />
                {err && (
                  <p role="alert" className="text-small text-danger">
                    {err}
                  </p>
                )}
              </div>
            );
          }
          return (
            <Field key={k} label={label} required={required.has(k)} error={err}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={meta.kind === 'integer' ? 1 : 0.1}
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
      <Button variant="link" className="w-fit" onClick={() => setAll((v) => !v)}>
        {all ? t('showRelevant') : t('showAll')}
      </Button>
    </StepSection>
  );
}
