'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Building2, Bus, GraduationCap, Landmark, MapPin, MapPinned, SquareParking, Store, TrendingDown, TrendingUp, Scale, type LucideIcon } from 'lucide-react';
import { POI_CATEGORIES, type PoiCategory } from '@lokacia/contracts';
import { Skeleton, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import type { Insights } from '../data';
import { IconTile, ListingSection, Segmented, type IconTone } from './section';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="size-full rounded-2xl" /> });

const RADII = [300, 500, 1000] as const;
const CAT: Record<string, { icon: LucideIcon; tone: IconTone }> = {
  competitor: { icon: Store, tone: 'danger' },
  transport: { icon: Bus, tone: 'link' },
  school: { icon: GraduationCap, tone: 'primary' },
  business_center: { icon: Building2, tone: 'accent' },
  parking: { icon: SquareParking, tone: 'success' },
  bank: { icon: Landmark, tone: 'neutral' },
};

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
  const VerdictIcon = price?.verdict === 'above' ? TrendingUp : price?.verdict === 'below' ? TrendingDown : Scale;

  return (
    <ListingSection
      id="insights-title"
      title={t('title')}
      subtitle={t('subtitle', { radius })}
      icon={<MapPinned className="size-5" strokeWidth={2} />}
      tone="link"
      action={<Segmented label={t('radius')} value={radius} onChange={setRadius} options={RADII.map((r) => ({ value: r, label: t('meters', { n: r }) }))} />}
    >
      <div className="relative h-72 overflow-hidden rounded-2xl md:h-96">
        <MapView center={center} zoom={radius > 500 ? 14 : 15} points={points} pois={pois} radiusM={radius} ariaLabel={t('mapLabel')} className="h-full rounded-2xl" />
        {price && (
          <div
            className={cn(
              'glass pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl border border-border p-3 shadow-md sm:right-auto sm:max-w-sm',
            )}
          >
            <IconTile tone={price.verdict === 'above' ? 'danger' : price.verdict === 'below' ? 'success' : 'primary'} size="sm">
              <VerdictIcon className="size-[18px]" strokeWidth={2} />
            </IconTile>
            <div className="min-w-0">
              <div className="text-[12.5px] text-muted">{t('price')}</div>
              <div className={cn('text-[17px] font-bold leading-tight', price.verdict === 'above' ? 'text-danger' : price.verdict === 'below' ? 'text-success' : 'text-text')}>
                {price.verdict === 'above' ? t('above', { pct: price.deltaPct }) : price.verdict === 'below' ? t('below', { pct: Math.abs(price.deltaPct) }) : t('fair')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4" aria-live="polite" aria-busy={loading}>
        {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-small text-danger">{t('error')}</p>}
        {price && (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-2 p-4">
              <dt className="text-small text-muted">{t('thisSpace')}</dt>
              <dd className="mt-0.5 text-[19px] font-bold tabular">{fmt.money(price.perM2Minor)} / {fmt.areaUnit}</dd>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4">
              <dt className="text-small text-muted">{t('districtAvg', { district: price.districtName ?? '' })}</dt>
              <dd className="mt-0.5 text-[19px] font-bold tabular">{fmt.money(price.districtAvgM2Minor)} / {fmt.areaUnit}</dd>
            </div>
          </dl>
        )}
        {!data && loading && <Skeleton className="h-48 w-full rounded-2xl" />}
        <ul className={cn('grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3', loading && 'opacity-60')}>
          {(data?.categories ?? []).map((c) => {
            const meta = CAT[c.category] ?? { icon: MapPin, tone: 'neutral' as const };
            return (
              <li key={c.category} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <IconTile tone={meta.tone} size="sm">
                    <meta.icon className="size-[18px]" strokeWidth={2} />
                  </IconTile>
                  <span className="text-[26px] font-bold leading-none tracking-tight tabular">{c.count}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{(POI_CATEGORIES as readonly string[]).includes(c.category) ? t(`poi.${c.category as PoiCategory}`) : c.label}</div>
                  {c.nearest.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-muted">
                      {c.nearest.slice(0, 2).map((n) => (
                        <li key={`${n.name}-${n.distanceM}`} className="flex justify-between gap-2">
                          <span className="truncate">{n.name}</span>
                          <span className="shrink-0 tabular">{t('distance', { n: n.distanceM })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">{t('none')}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ListingSection>
  );
}
