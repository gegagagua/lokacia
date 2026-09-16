'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { PlanDto, ReportPreview } from '@lokacia/contracts';
import { Card, cn, Field, Select, Skeleton } from '@lokacia/ui';
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

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="min-w-0 p-5">
        <div role="tablist" aria-label={t('city')} className="flex gap-1 overflow-x-auto border-b border-border">
          {cities.map((c) => (
            <button key={c.value} role="tab" type="button" aria-selected={c.value === city} onClick={() => setCity(c.value)} className={cn('-mb-px h-10 shrink-0 border-b-2 px-3 text-[15px]', c.value === city ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text')}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={t('district')}>
            <Select value={districtId} onChange={(e) => setDistrictId(e.target.value)} options={inCity.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label={t('businessType')}>
            <Select value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder={t('anyType')} options={types} />
          </Field>
        </div>
        <div className="mt-5" aria-live="polite">
          <h2 className="text-h3 font-semibold">{t('preview')}</h2>
          {isLoading ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : error || !preview ? (
            <p className="mt-2 text-small text-muted">{t('previewEmpty')}</p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-card border border-border p-3">
                <dt className="text-small text-muted">{t('activeCount')}</dt>
                <dd className="compact text-h2 font-semibold tabular">{fmt.number(preview.activeCount)}</dd>
              </div>
              <div className="rounded-card border border-border p-3">
                <dt className="text-small text-muted">{t('avgPrice')}</dt>
                <dd className="compact text-h2 font-semibold tabular">{preview.avgPriceM2Minor ? fmt.money(preview.avgPriceM2Minor) : '—'}</dd>
              </div>
              <div className="rounded-card border border-border p-3">
                <dt className="text-small text-muted">{t('competitors')}</dt>
                <dd className="compact text-h2 font-semibold tabular">{fmt.number(preview.competitorsCount)}</dd>
              </div>
              <div className="rounded-card border border-border p-3">
                <dt className="text-small text-muted">{t('sample')}</dt>
                <dd className="compact text-h2 font-semibold tabular">{fmt.number(preview.sampleSize)}</dd>
              </div>
            </dl>
          )}
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        {products.map((p) => (
          <Card key={p.key} className="flex flex-col p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-h3 font-semibold">{p.nameKa}</h2>
              <div className="compact text-h2 font-semibold tabular">
                {promoActive ? (
                  <>
                    <span className="text-body text-muted line-through">{fmt.money(p.priceMinor)}</span> 0 ₾
                  </>
                ) : (
                  fmt.money(p.priceMinor)
                )}
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-small">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <CheckoutButton className="mt-4" planKey={p.key} disabledReason={districtId ? undefined : t('chooseDistrict')} body={{ districtId, businessType: businessType || undefined, returnPath: '/reports' }} loginNext="/reports">
              {loggedIn ? (promoActive ? t('getFree') : t('buy')) : t('loginToBuy')}
            </CheckoutButton>
          </Card>
        ))}
        <p className="text-small text-muted">{t('note')}</p>
      </div>
    </div>
  );
}
