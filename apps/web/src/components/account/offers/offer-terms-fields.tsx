'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatMoney } from '@lokacia/contracts';
import { Checkbox, Field, Input, RadioGroup, Textarea } from '@lokacia/ui';

export type OfferTerms = { priceGel: string; termMonths: string; freeMonths: string; indexationPct: string; fitoutPaidBy: 'tenant' | 'owner' | 'shared'; equipmentIncluded: boolean; message: string };
export type TermsErrors = Partial<Record<keyof OfferTerms, string>>;

export function termsFrom(o: { priceMinor: number; termMonths: number; freeMonths: number; indexationPct: number; fitoutPaidBy: OfferTerms['fitoutPaidBy']; equipmentIncluded: boolean }): OfferTerms {
  return { priceGel: String(o.priceMinor / 100), termMonths: String(o.termMonths), freeMonths: String(o.freeMonths), indexationPct: String(o.indexationPct), fitoutPaidBy: o.fitoutPaidBy, equipmentIncluded: o.equipmentIncluded, message: '' };
}

/** Validates and converts to the API body (offerSchema without listingId). */
export function termsToBody(v: OfferTerms, dealType: string, t: (k: string) => string): { body?: { priceMinor: number; termMonths: number; freeMonths: number; indexationPct: number; fitoutPaidBy: OfferTerms['fitoutPaidBy']; equipmentIncluded: boolean; message: string | null }; errors: TermsErrors } {
  const errors: TermsErrors = {};
  const price = Number(v.priceGel.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(price) || price <= 0) errors.priceGel = t('errors.price');
  const isSale = dealType === 'sale' || dealType === 'transfer';
  const term = isSale ? 1 : Number(v.termMonths);
  if (!Number.isInteger(term) || term < 1 || term > 360) errors.termMonths = t('errors.term');
  const free = Number(v.freeMonths || 0);
  if (!Number.isInteger(free) || free < 0 || free > 24 || (!isSale && free >= term)) errors.freeMonths = t('errors.free');
  const idx = Number(v.indexationPct || 0);
  if (!Number.isInteger(idx) || idx < 0 || idx > 30) errors.indexationPct = t('errors.indexation');
  if (v.message.length > 2000) errors.message = t('errors.message');
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    body: { priceMinor: Math.round(price * 100), termMonths: term, freeMonths: isSale ? 0 : free, indexationPct: isSale ? 0 : idx, fitoutPaidBy: v.fitoutPaidBy, equipmentIncluded: dealType === 'transfer' ? v.equipmentIncluded : false, message: v.message.trim() || null },
  };
}

export function OfferTermsFields({ value, onChange, errors = {}, dealType, equipment = [] }: { value: OfferTerms; onChange: (v: OfferTerms) => void; errors?: TermsErrors; dealType: string; equipment?: { name: string; qty: number; priceMinor: number }[] }) {
  const t = useTranslations('offers.form');
  const set = (patch: Partial<OfferTerms>) => onChange({ ...value, ...patch });
  const isSale = dealType === 'sale' || dealType === 'transfer';
  const eqTotal = equipment.reduce((a, e) => a + e.priceMinor * e.qty, 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={isSale ? t('priceTotal') : t('priceMonthly')} error={errors.priceGel} required>
        <Input type="number" inputMode="decimal" min={1} step="any" suffix="₾" value={value.priceGel} onChange={(e) => set({ priceGel: e.target.value })} />
      </Field>
      {!isSale && (
        <Field label={t('term')} hint={t('termHint')} error={errors.termMonths} required>
          <Input type="number" inputMode="numeric" min={1} max={360} suffix={t('monthsShort')} value={value.termMonths} onChange={(e) => set({ termMonths: e.target.value })} />
        </Field>
      )}
      {!isSale && (
        <Field label={t('freeMonths')} hint={t('freeMonthsHint')} error={errors.freeMonths}>
          <Input type="number" inputMode="numeric" min={0} max={24} suffix={t('monthsShort')} value={value.freeMonths} onChange={(e) => set({ freeMonths: e.target.value })} />
        </Field>
      )}
      {!isSale && (
        <Field label={t('indexation')} hint={t('indexationHint')} error={errors.indexationPct}>
          <Input type="number" inputMode="numeric" min={0} max={30} suffix="%" value={value.indexationPct} onChange={(e) => set({ indexationPct: e.target.value })} />
        </Field>
      )}
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-small font-medium">{t('fitoutPaidBy')}</legend>
        <RadioGroup
          value={value.fitoutPaidBy}
          onValueChange={(v) => set({ fitoutPaidBy: v as OfferTerms['fitoutPaidBy'] })}
          className="flex-row flex-wrap gap-x-6"
          options={[
            { value: 'tenant', label: t('fitout.tenant') },
            { value: 'owner', label: t('fitout.owner') },
            { value: 'shared', label: t('fitout.shared') },
          ]}
        />
      </fieldset>
      {dealType === 'transfer' && (
        <div className="rounded-card border border-border bg-surface-2 p-4 sm:col-span-2">
          <Checkbox checked={value.equipmentIncluded} onCheckedChange={(c) => set({ equipmentIncluded: c === true })} label={t('equipmentIncluded')} />
          {equipment.length > 0 ? (
            <ul className="mt-3 divide-y divide-border text-[15px]">
              {equipment.map((e, i) => (
                <li key={`${e.name}-${i}`} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">
                    {e.name}
                    {e.qty > 1 && <span className="text-muted"> × {e.qty}</span>}
                  </span>
                  <span className="tabular">{formatMoney(e.priceMinor * e.qty)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 py-1.5 font-medium">
                <span>{t('equipmentTotal')}</span>
                <span className="tabular">{formatMoney(eqTotal)}</span>
              </li>
            </ul>
          ) : (
            <p className="mt-2 text-small text-muted">{t('equipmentEmpty')}</p>
          )}
        </div>
      )}
      <Field label={t('message')} hint={t('messageHint')} error={errors.message} className="sm:col-span-2">
        <Textarea value={value.message} maxLength={2000} onChange={(e) => set({ message: e.target.value })} />
      </Field>
    </div>
  );
}
