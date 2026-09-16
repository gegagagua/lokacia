'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Building2, Check, Coins, Info, Layers, Sparkles, Store } from 'lucide-react';
import type { PlanDto, ReportPreview } from '@lokacia/contracts';
import { cn, Field, Select, Skeleton } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { CheckoutButton } from '@/components/billing/checkout-button';
import { useFormat } from '@/i18n/use-format';

type Opt = { value: string; label: string };

export function ReportBuilder({ loggedIn, cities, districts, types, products, promoActive }: { loggedIn: boolean; cities: Opt[]; districts: { id: string; city: string; name: string }[]; types: Opt[]; products: PlanDto[]; promoActive: boolean }) {
  const t = useTranslations('billing.reports');
  const fmt = useFormat();
  const [city, setCity] = React.useState(cities[0]?.value ?? 'tbilisi');
  const inCity = districts.filter((d) => d.city === city);
  const [districtId, setDistrictId] = React.useState(inCity[0]?.id ?? '');
  const [businessType, setBusinessType] = React.useState(types[0]?.value ?? '');
  React.useEffect(() => {
    const first = districts.find((d) => d.city === city);
    setDistrictId(first?.id ?? '');
  }, [city, districts]);
  const q = districtId ? `/billing/reports/preview?districtId=${districtId}${businessType ? `&businessType=${encodeURIComponent(businessType)}` : ''}` : null;
  const { data: preview, isLoading, error } = useSWR<ReportPreview>(q, fetcher);
  const districtName = inCity.find((d) => d.id === districtId)?.name;
  const typeName = types.find((x) => x.value === businessType)?.label;

  const stats = preview
    ? [
        { icon: Building2, label: t('activeCount'), value: fmt.number(preview.activeCount) },
        { icon: Coins, label: t('avgPrice'), value: preview.avgPriceM2Minor ? fmt.money(preview.avgPriceM2Minor) : '—' },
        { icon: Store, label: t('competitors'), value: fmt.number(preview.competitorsCount) },
        { icon: Layers, label: t('sample'), value: fmt.number(preview.sampleSize) },
      ]
    : [];

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="builder-h" className="card min-w-0 p-5 md:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-small font-bold text-primary-contrast tabular" aria-hidden>
            1
          </span>
          <h2 id="builder-h" className="text-[20px] font-bold tracking-tight">
            {t('stepLocation')}
          </h2>
        </div>
        <div role="tablist" aria-label={t('city')} className="mt-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {cities.map((c) => (
            <button
              key={c.value}
              role="tab"
              type="button"
              aria-selected={c.value === city}
              onClick={() => setCity(c.value)}
              className={cn(
                'h-9 shrink-0 rounded-full px-4 text-[15px] font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                c.value === city ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={t('district')}>
            <Select value={districtId} onChange={(e) => setDistrictId(e.target.value)} options={inCity.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label={t('businessType')}>
            <Select value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder={t('anyType')} options={types} />
          </Field>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface-2/60 p-4 md:p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{t('preview')}</h3>
            {districtName && (
              <span className="inline-flex h-7 items-center rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary-soft-text">
                {[districtName, typeName].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] rounded-2xl" />
              ))}
            </div>
          ) : error || !preview ? (
            <p className="mt-3 flex items-center gap-2 text-small text-muted">
              <Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t('previewEmpty')}
            </p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {stats.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                  <dt className="flex items-center gap-2 text-small text-muted">
                    <Icon className="size-4 shrink-0 text-primary-soft-text" strokeWidth={2} aria-hidden />
                    <span className="min-w-0">{label}</span>
                  </dt>
                  <dd className="mt-2 text-[24px] font-bold leading-tight tracking-tight tabular md:text-[28px]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section aria-labelledby="products-h" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-small font-bold text-primary-contrast tabular" aria-hidden>
            2
          </span>
          <h2 id="products-h" className="text-[20px] font-bold tracking-tight">
            {t('stepProduct')}
          </h2>
        </div>
        {products.map((p, i) => {
          const pro = i === products.length - 1 && products.length > 1;
          return (
            <article key={p.key} className={cn('relative flex flex-col rounded-card border bg-surface p-6 transition-all duration-200', pro ? 'border-primary shadow-md ring-1 ring-primary' : 'border-border shadow-sm')}>
              {pro && (
                <span className="absolute -top-3 right-5 inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2.5 text-[12px] font-semibold text-primary-contrast">
                  <Sparkles className="size-3" strokeWidth={2} aria-hidden />
                  {t('mostDetailed')}
                </span>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-[20px] font-bold leading-tight tracking-tight">{p.nameKa}</h3>
                <div className="text-right tabular">
                  <div className="text-[30px] font-bold leading-none tracking-tight">{promoActive ? '0 ₾' : fmt.money(p.priceMinor)}</div>
                  {promoActive && <div className="mt-1 text-small text-muted line-through">{fmt.money(p.priceMinor)}</div>}
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-[15px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', pro ? 'bg-primary text-primary-contrast' : 'bg-primary-soft text-primary-soft-text')}>
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <CheckoutButton className="mt-5 w-full" size="lg" variant={pro ? 'primary' : 'secondary'} planKey={p.key} disabledReason={districtId ? undefined : t('chooseDistrict')} body={{ districtId, businessType: businessType || undefined, returnPath: '/reports' }} loginNext="/reports">
                {loggedIn ? (promoActive ? t('getFree') : t('buy')) : t('loginToBuy')}
              </CheckoutButton>
            </article>
          );
        })}
        <p className="flex items-start gap-2 px-1 text-small text-muted">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          {t('note')}
        </p>
      </section>
    </div>
  );
}
