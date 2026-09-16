'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Calculator, ChevronDown } from 'lucide-react';
import { estimateMonthlyCost, type ListingDetail } from '@lokacia/contracts';
import { Switch, cn } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';
import { ListingSection, Segmented } from './section';

export type CalcType = { slug: string; nameKa: string; utilityCoef: number; fitoutPerM2Minor: number };

const FITOUT_MONTHS = [12, 24, 36] as const;

function Row({ label, value, strong, hint, dot }: { label: string; value: string; strong?: boolean; hint?: string; dot?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2.5', strong ? 'mt-1 border-t border-border-strong pt-3.5' : 'border-b border-border last:border-b-0')}>
      <dt className={cn('flex min-w-0 items-center gap-2 text-[15px]', strong ? 'font-semibold' : 'text-muted')}>
        {dot && <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', dot)} />}
        <span>
          {label}
          {hint && <span className="ml-1 text-small text-muted">({hint})</span>}
        </span>
      </dt>
      <dd className={cn('shrink-0 tabular', strong ? 'text-[20px] font-bold tracking-tight' : 'font-semibold')}>{value}</dd>
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
  const selectId = React.useId();
  const type = types.find((x) => x.slug === slug) ?? types[0];
  const isLease = l.dealType === 'rent' || l.dealType === 'short_term';
  const equipmentMinor = l.equipmentPriceMinor ?? l.equipment.reduce((s, e) => s + e.priceMinor * e.qty, 0);

  if (!isLease) {
    const perM2 = Math.round(l.priceMinor / l.areaM2);
    const total = l.priceMinor + equipmentMinor;
    return (
      <ListingSection id="calc-title" title={t('saleTitle')} icon={<Calculator className="size-5" strokeWidth={2} />} tone="accent">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="hero-gradient flex flex-col justify-center rounded-2xl p-6 shadow-md">
            <div className="text-[14px] font-medium opacity-80">{t('pricePerM2')}</div>
            <div className="mt-1 text-[36px] font-bold leading-tight tracking-tight tabular">
              {formatMoney(perM2, l.currency)}
              <span className="ml-1 text-[16px] font-medium opacity-80">/ {fmt.areaUnit}</span>
            </div>
          </div>
          <dl>
            <Row label={t('spacePrice')} value={formatMoney(l.priceMinor, l.currency)} dot="bg-primary-500" />
            {equipmentMinor > 0 && <Row label={t('equipmentPrice')} value={formatMoney(equipmentMinor, l.currency)} dot="bg-accent" />}
            {equipmentMinor > 0 && <Row strong label={t('total')} value={formatMoney(total, l.currency)} />}
          </dl>
        </div>
      </ListingSection>
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
  const parts = [
    { key: 'rent', value: est.rentMinor, cls: 'bg-white/90' },
    { key: 'utilities', value: est.utilitiesMinor, cls: 'bg-accent' },
    { key: 'serviceFee', value: est.serviceFeeMinor, cls: 'bg-white/50' },
    { key: 'fitout', value: withFitout ? est.fitoutMonthlyMinor : 0, cls: 'bg-white/30' },
  ].filter((p) => p.value > 0);
  const sum = Math.max(1, parts.reduce((s, p) => s + p.value, 0));

  return (
    <ListingSection id="calc-title" title={t('title')} subtitle={t('subtitle')} icon={<Calculator className="size-5" strokeWidth={2} />} tone="accent">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
        {types.length > 1 && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={selectId} className="text-small font-semibold">
              {t('businessType')}
            </label>
            <div className="relative">
              <select
                id={selectId}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-11 w-full appearance-none rounded-button border border-border bg-surface pl-3.5 pr-10 text-[15px] shadow-xs focus-visible:shadow-ring focus-visible:outline-none md:min-w-52"
              >
                {types.map((x) => (
                  <option key={x.slug} value={x.slug}>
                    {x.nameKa}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} aria-hidden />
            </div>
          </div>
        )}
        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className="mb-1.5 text-small font-semibold">{t('fitoutMonths')}</legend>
          <Segmented
            label={t('fitoutMonths')}
            disabled={!withFitout}
            value={months}
            onChange={(m) => setMonths(m)}
            options={FITOUT_MONTHS.map((m) => ({ value: m, label: t('months', { n: m }) }))}
            className="w-full bg-surface-3 md:w-auto"
          />
        </fieldset>
        <div className="md:pb-2.5">
          <Switch checked={withFitout} onCheckedChange={setWithFitout} label={t('includeFitout')} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" aria-live="polite">
        <div className="hero-gradient flex flex-col justify-between gap-5 rounded-2xl p-6 shadow-md">
          <div>
            <div className="text-[14px] font-medium opacity-80">{t('effective')}</div>
            <div className="mt-1 text-[36px] font-bold leading-tight tracking-tight tabular md:text-[40px]">{formatMoney(est.effectiveMonthlyMinor, l.currency)}</div>
          </div>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
            {parts.map((p) => (
              <span key={p.key} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.cls)} style={{ width: `${(p.value / sum) * 100}%` }} />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <dt className="text-[12.5px] opacity-80">{t('monthly')}</dt>
              <dd className="text-[17px] font-bold tabular">{formatMoney(est.monthlyMinor, l.currency)}</dd>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <dt className="text-[12.5px] opacity-80">{t('firstMonth')}</dt>
              <dd className="text-[17px] font-bold tabular">{formatMoney(est.firstMonthMinor, l.currency)}</dd>
            </div>
          </dl>
        </div>
        <dl>
          <Row label={t('rent')} value={formatMoney(est.rentMinor, l.currency)} dot="bg-primary" />
          <Row label={t('utilities')} value={l.utilitiesIncluded ? t('utilitiesIncluded') : formatMoney(est.utilitiesMinor)} dot="bg-accent" />
          {est.serviceFeeMinor > 0 && <Row label={t('serviceFee')} value={formatMoney(est.serviceFeeMinor, l.currency)} dot="bg-primary-500/60" />}
          <Row strong label={t('monthly')} value={formatMoney(est.monthlyMinor, l.currency)} />
          <Row label={t('deposit')} value={formatMoney(est.depositMinor, l.currency)} />
          {withFitout && <Row label={t('fitout')} value={formatMoney(est.fitoutMinor)} dot="bg-primary-500/30" />}
          <Row label={t('firstMonth')} value={formatMoney(est.firstMonthMinor, l.currency)} />
        </dl>
      </div>
      {type && (
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-small text-muted">
          {t('note', { coef: formatNumber(type.utilityCoef, 1), type: type.nameKa, fitout: formatNumber(type.fitoutPerM2Minor / 100) })}
        </p>
      )}
    </ListingSection>
  );
}
