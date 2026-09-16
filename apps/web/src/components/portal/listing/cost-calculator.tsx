'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Calculator } from 'lucide-react';
import { estimateMonthlyCost, type ListingDetail } from '@lokacia/contracts';
import { Switch, cn } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';

export type CalcType = { slug: string; nameKa: string; utilityCoef: number; fitoutPerM2Minor: number };

const FITOUT_MONTHS = [12, 24, 36] as const;

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2', strong ? 'border-t border-border-strong font-semibold' : 'border-b border-border last:border-b-0')}>
      <dt className={cn('text-[15px]', !strong && 'text-muted')}>
        {label}
        {hint && <span className="ml-1 text-small text-muted">({hint})</span>}
      </dt>
      <dd className={cn('tabular', strong && 'compact text-h3')}>{value}</dd>
    </div>
  );
}

/** P9: real monthly cost — rent + utilities (area × business-type coefficient) + service fee + deposit + fit-out. */
export function CostCalculator({ listing: l, types }: { listing: ListingDetail; types: CalcType[] }) {
  const t = useTranslations('listing.calculator');
  const fmt = useFormat();
  const formatMoney = fmt.money;
  const formatNumber = fmt.number;
  const [slug, setSlug] = React.useState(types[0]?.slug ?? '');
  const [months, setMonths] = React.useState<(typeof FITOUT_MONTHS)[number]>(24);
  const [withFitout, setWithFitout] = React.useState(true);
  const type = types.find((x) => x.slug === slug) ?? types[0];
  const isLease = l.dealType === 'rent' || l.dealType === 'short_term';
  const equipmentMinor = l.equipmentPriceMinor ?? l.equipment.reduce((s, e) => s + e.priceMinor * e.qty, 0);

  if (!isLease) {
    const perM2 = Math.round(l.priceMinor / l.areaM2);
    return (
      <section aria-labelledby="calc-title" className="rounded-card border border-border bg-surface p-5">
        <h2 id="calc-title" className="flex items-center gap-2 text-h3 font-semibold">
          <Calculator className="size-5 text-link" strokeWidth={1.5} aria-hidden />
          {t('saleTitle')}
        </h2>
        <dl className="mt-3">
          <Row label={t('pricePerM2')} value={`${formatMoney(perM2, l.currency)} / ${fmt.areaUnit}`} />
          <Row label={t('spacePrice')} value={formatMoney(l.priceMinor, l.currency)} />
          {equipmentMinor > 0 && <Row label={t('equipmentPrice')} value={formatMoney(equipmentMinor, l.currency)} />}
          {equipmentMinor > 0 && <Row strong label={t('total')} value={formatMoney(l.priceMinor + equipmentMinor, l.currency)} />}
        </dl>
      </section>
    );
  }

  const est = estimateMonthlyCost({
    rentMinor: l.priceMinor,
    areaM2: l.areaM2,
    utilityCoef: type?.utilityCoef ?? 3,
    serviceFeeMinor: l.serviceFeeMinor,
    depositMonths: l.depositMonths,
    fitoutPerM2Minor: withFitout ? (type?.fitoutPerM2Minor ?? 0) : 0,
    fitoutMonths: months,
    utilitiesIncluded: l.utilitiesIncluded,
  });

  return (
    <section aria-labelledby="calc-title" className="rounded-card border border-border bg-surface p-5">
      <h2 id="calc-title" className="flex items-center gap-2 text-h3 font-semibold">
        <Calculator className="size-5 text-link" strokeWidth={1.5} aria-hidden />
        {t('title')}
      </h2>
      <p className="mt-1 text-small text-muted">{t('subtitle')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {types.length > 1 && (
          <label className="flex flex-col gap-1.5 text-small">
            <span className="font-medium">{t('businessType')}</span>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-button border border-border-strong bg-surface px-3 text-[15px]">
              {types.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.nameKa}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-small font-medium">{t('fitoutMonths')}</legend>
          <div className="flex gap-1" role="radiogroup">
            {FITOUT_MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={months === m}
                disabled={!withFitout}
                onClick={() => setMonths(m)}
                className={cn('h-9 flex-1 rounded-button border text-small tabular transition-colors duration-150 disabled:opacity-50', months === m ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:bg-surface-2')}
              >
                {t('months', { n: m })}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Switch checked={withFitout} onCheckedChange={setWithFitout} label={t('includeFitout')} />
        </div>
      </div>

      <dl className="mt-4" aria-live="polite">
        <Row label={t('rent')} value={formatMoney(est.rentMinor, l.currency)} />
        <Row label={t('utilities')} value={l.utilitiesIncluded ? t('utilitiesIncluded') : formatMoney(est.utilitiesMinor)} />
        {est.serviceFeeMinor > 0 && <Row label={t('serviceFee')} value={formatMoney(est.serviceFeeMinor, l.currency)} />}
        <Row strong label={t('monthly')} value={formatMoney(est.monthlyMinor, l.currency)} />
        <Row label={t('deposit')} value={formatMoney(est.depositMinor, l.currency)} />
        {withFitout && <Row label={t('fitout')} value={formatMoney(est.fitoutMinor)} />}
        <Row label={t('firstMonth')} value={formatMoney(est.firstMonthMinor, l.currency)} />
        <Row strong label={t('effective')} value={formatMoney(est.effectiveMonthlyMinor, l.currency)} />
      </dl>
      {type && (
        <p className="mt-3 text-small text-muted">
          {t('note', { coef: formatNumber(type.utilityCoef, 1), type: type.nameKa, fitout: formatNumber(type.fitoutPerM2Minor / 100) })}
        </p>
      )}
    </section>
  );
}
