'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { MapPinned } from 'lucide-react';
import { POI_CATEGORIES, type PoiCategory } from '@lokacia/contracts';
import { Skeleton, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import type { Insights } from '../data';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-card" /> });

const RADII = [300, 500, 1000] as const;
const DOT: Record<string, string> = { competitor: 'bg-danger', transport: 'bg-link', school: 'bg-primary', business_center: 'bg-text', parking: 'bg-stone', bank: 'bg-stone' };

/** P3: location analytics — POIs by category in a radius + price vs district average + map. */
export function InsightsPanel({ initial, query }: { initial: Insights | null; query: { lat: number; lng: number; businessType?: string; priceMinor: number; areaM2: number; dealType: string } }) {
  const t = useTranslations('listing.insights');
  const fmt = useFormat();
  const [radius, setRadius] = React.useState<number>(initial?.radiusM ?? 500);
  const [data, setData] = React.useState<Insights | null>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initial) return;
    }
    let cancelled = false;
    const p = new URLSearchParams({ lat: String(query.lat), lng: String(query.lng), radiusM: String(radius), priceMinor: String(query.priceMinor), areaM2: String(query.areaM2), dealType: query.dealType });
    if (query.businessType) p.set('businessType', query.businessType);
    setLoading(true);
    setError(false);
    apiFetch<Insights>(`/geo/insights?${p}`)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  const pois = React.useMemo(
    () => (data?.categories ?? []).flatMap((c) => c.nearest.map((n, i) => ({ id: `${c.category}-${i}`, lat: n.lat, lng: n.lng, name: n.name, category: c.category }))),
    [data],
  );
  const points = React.useMemo(() => [{ id: 'listing', lat: query.lat, lng: query.lng, label: '●', vip: true }], [query.lat, query.lng]);
  const center = React.useMemo<[number, number]>(() => [query.lng, query.lat], [query.lng, query.lat]);
  const price = data?.price;

  return (
    <section aria-labelledby="insights-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="insights-title" className="flex items-center gap-2 text-h3 font-semibold">
            <MapPinned className="size-5 text-link" strokeWidth={1.5} aria-hidden />
            {t('title')}
          </h2>
          <p className="text-small text-muted">{t('subtitle', { radius })}</p>
        </div>
        <div role="radiogroup" aria-label={t('radius')} className="flex gap-1">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radius === r}
              onClick={() => setRadius(r)}
              className={cn('h-8 rounded-button border px-3 text-small tabular transition-colors duration-150', radius === r ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:bg-surface-2')}
            >
              {t('meters', { n: r })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 lg:h-auto lg:min-h-80">
          <MapView center={center} zoom={radius > 500 ? 14 : 15} points={points} pois={pois} radiusM={radius} ariaLabel={t('mapLabel')} className="h-full" />
        </div>
        <div className="flex flex-col gap-3" aria-live="polite" aria-busy={loading}>
          {error && <p className="text-small text-danger">{t('error')}</p>}
          {price && (
            <div className={cn('rounded-card border p-4', price.verdict === 'above' ? 'border-danger bg-danger/10' : price.verdict === 'below' ? 'border-success bg-success/10' : 'border-border bg-surface')}>
              <div className="text-small text-muted">{t('price')}</div>
              <div className={cn('compact text-h3 font-semibold', price.verdict === 'above' ? 'text-danger' : price.verdict === 'below' ? 'text-success' : 'text-text')}>
                {price.verdict === 'above' ? t('above', { pct: price.deltaPct }) : price.verdict === 'below' ? t('below', { pct: Math.abs(price.deltaPct) }) : t('fair')}
              </div>
              <div className="mt-1 text-small tabular">{t('perM2', { price: fmt.money(price.perM2Minor) })}</div>
              <div className="text-small text-muted tabular">{t('avg', { district: price.districtName ?? '', price: fmt.money(price.districtAvgM2Minor) })}</div>
            </div>
          )}
          {!data && loading && <Skeleton className="h-48 w-full" />}
          <ul className={cn('grid gap-2 sm:grid-cols-2', loading && 'opacity-60')}>
            {(data?.categories ?? []).map((c) => (
              <li key={c.category} className="rounded-card border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[15px]">
                    <span className={cn('size-2.5 rounded-full', DOT[c.category] ?? 'bg-stone')} aria-hidden />
                    {(POI_CATEGORIES as readonly string[]).includes(c.category) ? t(`poi.${c.category as PoiCategory}`) : c.label}
                  </span>
                  <span className="compact text-h3 font-semibold tabular">{c.count}</span>
                </div>
                {c.nearest.length > 0 ? (
                  <ul className="mt-1 text-small text-muted">
                    {c.nearest.slice(0, 2).map((n) => (
                      <li key={`${n.name}-${n.distanceM}`} className="flex justify-between gap-2">
                        <span className="truncate">{n.name}</span>
                        <span className="shrink-0 tabular">{t('distance', { n: n.distanceM })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-small text-muted">{t('none')}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
