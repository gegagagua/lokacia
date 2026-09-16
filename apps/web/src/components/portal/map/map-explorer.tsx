'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, FileText } from 'lucide-react';
import { formatNumber } from '@lokacia/contracts';
import { Button, Card, Drawer, Field, Select, Skeleton, SpecRow, Table, type Column } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="size-full min-h-64 rounded-card" /> });

export type DistrictStat = { id: string; slug: string; name: string; center: [number, number]; avgPriceM2Minor: number | null; activeCount: number; vacancyCount: number; medianAreaM2: number | null };
type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; id?: string; properties: Record<string, unknown>; geometry: unknown }[] };
export type MapState = { metric: 'price' | 'vacancy'; businessType: string; dealType: 'rent' | 'sale'; city: string };

export const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'] as const;
const LIGHT = [0xed, 0xf0, 0xeb];
const MID = [0x8f, 0xb8, 0xa8];
const DARK = [0x1e, 0x4a, 0x42];
const STEPS = 5;

/** Same ramp as MapView's choropleth (plaster → sage → Mtatsminda green), sampled into discrete legend steps. */
function rampColor(t: number) {
  const [a, b, k] = t <= 0.5 ? [LIGHT, MID, t / 0.5] : [MID, DARK, (t - 0.5) / 0.5];
  return `#${a.map((c, i) => Math.round(c + (b[i]! - c) * k).toString(16).padStart(2, '0')).join('')}`;
}

function toQuery(s: MapState) {
  const p = new URLSearchParams();
  if (s.metric !== 'price') p.set('metric', s.metric);
  if (s.businessType) p.set('businessType', s.businessType);
  if (s.dealType !== 'rent') p.set('dealType', s.dealType);
  if (s.city !== 'tbilisi') p.set('city', s.city);
  return p;
}

function useIsDesktop() {
  const [desktop, setDesktop] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

export function MapExplorer({ initial, initialStats, initialGeojson, businessTypes }: { initial: MapState; initialStats: DistrictStat[]; initialGeojson: FC; businessTypes: { slug: string; nameKa: string }[] }) {
  const t = useTranslations('map');
  const router = useRouter();
  const pathname = usePathname();
  const desktop = useIsDesktop();
  const [state, setState] = React.useState<MapState>(initial);
  const [stats, setStats] = React.useState(initialStats);
  const [geojson, setGeojson] = React.useState(initialGeojson);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const q = toQuery(state);
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false });
    const statsQ = new URLSearchParams({ city: state.city, dealType: state.dealType });
    if (state.businessType) statsQ.set('businessType', state.businessType);
    let cancelled = false;
    setLoading(true);
    Promise.all([apiFetch<DistrictStat[]>(`/geo/districts/stats?${statsQ}`), apiFetch<FC>(`/taxonomy/districts.geojson?city=${state.city}`)])
      .then(([s, g]) => {
        if (cancelled) return;
        setStats(s);
        setGeojson(g);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const valueOf = React.useCallback((s: DistrictStat) => (state.metric === 'price' ? (s.avgPriceM2Minor != null ? Math.round(s.avgPriceM2Minor / 100) : null) : s.vacancyCount), [state.metric]);
  const statBy = React.useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats]);
  const values = stats.map(valueOf).filter((v): v is number => v != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const stops: [number, number] = [min, max > min ? max : min + 1];

  const polygons = React.useMemo(
    () =>
      ({
        type: 'FeatureCollection',
        features: geojson.features.map((f) => {
          const id = String(f.properties.id ?? f.id);
          const s = statBy.get(id);
          return { ...f, properties: { id, slug: f.properties.slug, name: f.properties.name, value: s ? valueOf(s) : null } };
        }),
      }) as unknown as GeoJSON.FeatureCollection,
    [geojson, statBy, valueOf],
  );

  const center = React.useMemo<[number, number] | undefined>(() => {
    if (!stats.length) return undefined;
    return [stats.reduce((a, s) => a + s.center[0], 0) / stats.length, stats.reduce((a, s) => a + s.center[1], 0) / stats.length];
  }, [stats]);

  const unit = state.metric === 'vacancy' ? t('spaces') : state.dealType === 'rent' ? t('perM2Month') : t('perM2');
  const legend = Array.from({ length: STEPS }, (_, i) => {
    const from = stops[0] + ((stops[1] - stops[0]) * i) / STEPS;
    return { color: rampColor((i + 0.5) / STEPS), from: Math.round(from) };
  });
  const sel = selected ? statBy.get(selected) : null;
  const update = (patch: Partial<MapState>) => setState((s) => ({ ...s, ...patch }));

  const columns: Column<DistrictStat>[] = [
    {
      key: 'name',
      header: t('col.name'),
      cell: (s) => (
        <button type="button" className="text-left font-medium text-link hover:underline" onClick={() => setSelected(s.id)}>
          {s.name}
        </button>
      ),
      sortValue: (s) => s.name,
    },
    { key: 'avg', header: t('col.avg'), cell: (s) => (s.avgPriceM2Minor != null ? `${formatNumber(s.avgPriceM2Minor / 100, 1)} ₾` : '—'), sortValue: (s) => s.avgPriceM2Minor, align: 'right' },
    { key: 'active', header: t('col.active'), cell: (s) => s.activeCount, sortValue: (s) => s.activeCount, align: 'right' },
    { key: 'vacancy', header: t('col.vacancy'), cell: (s) => s.vacancyCount, sortValue: (s) => s.vacancyCount, align: 'right' },
    { key: 'median', header: t('col.median'), cell: (s) => (s.medianAreaM2 != null ? `${formatNumber(s.medianAreaM2)} მ²` : '—'), sortValue: (s) => s.medianAreaM2, align: 'right' },
  ];

  const panel = sel ? (
    <div className="flex flex-col gap-4">
      <div>
        <SpecRow label={t('panel.avg')} value={sel.avgPriceM2Minor != null ? formatNumber(sel.avgPriceM2Minor / 100, 1) : '—'} unit={sel.avgPriceM2Minor != null ? (state.dealType === 'rent' ? t('perM2Month') : t('perM2')) : undefined} />
        <SpecRow label={t('panel.active')} value={sel.activeCount} />
        <SpecRow label={t('panel.vacancy')} value={sel.vacancyCount} />
        <SpecRow label={t('panel.median')} value={sel.medianAreaM2 != null ? formatNumber(sel.medianAreaM2) : '—'} unit={sel.medianAreaM2 != null ? 'მ²' : undefined} />
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link href={`/search?${new URLSearchParams({ districts: sel.slug, ...(state.businessType ? { businessType: state.businessType } : {}), dealType: state.dealType })}`}>
            {t('panel.listings')}
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/districts/${sel.slug}`}>{t('panel.district')}</Link>
        </Button>
      </div>
      <Card className="flex flex-col gap-2 p-4">
        <p className="flex items-center gap-2 font-medium">
          <FileText className="size-4 text-link" strokeWidth={1.5} aria-hidden />
          {t('panel.reportTitle')}
        </p>
        <p className="text-small text-muted">{t('panel.reportText')}</p>
        <Button asChild variant="link" className="self-start">
          <Link href={`/reports?${new URLSearchParams({ district: sel.slug, ...(state.businessType ? { businessType: state.businessType } : {}) })}`}>{t('panel.reportCta')}</Link>
        </Button>
      </Card>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <fieldset>
          <legend className="mb-1.5 text-small font-medium">{t('metric')}</legend>
          <div className="inline-flex w-full rounded-button border border-border-strong p-0.5">
            {(['price', 'vacancy'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={state.metric === m}
                onClick={() => update({ metric: m })}
                className={`h-8 flex-1 whitespace-nowrap rounded-[5px] px-3 text-small ${state.metric === m ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text'}`}
              >
                {m === 'price' ? t('metricPrice') : t('metricVacancy')}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t('businessType')}>
          <Select value={state.businessType} onChange={(e) => update({ businessType: e.target.value })} placeholder={t('allTypes')} options={businessTypes.map((b) => ({ value: b.slug, label: b.nameKa }))} />
        </Field>
        <Field label={t('dealType')}>
          <Select value={state.dealType} onChange={(e) => update({ dealType: e.target.value as MapState['dealType'] })} options={[{ value: 'rent', label: t('deal.rent') }, { value: 'sale', label: t('deal.sale') }]} />
        </Field>
        <Field label={t('city')}>
          <Select
            value={state.city}
            onChange={(e) => {
              setSelected(null);
              update({ city: e.target.value });
            }}
            options={CITIES.map((c) => ({ value: c, label: t(`cities.${c}`) }))}
          />
        </Field>
      </div>

      <p className="sr-only" aria-live="polite">
        {loading ? t('loading') : t('updated')}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[60dvh] min-h-80 lg:h-[560px]">
          <MapView
            key={`${state.metric}|${state.businessType}|${state.dealType}|${state.city}|${stats.length}`}
            center={center}
            zoom={state.city === 'tbilisi' ? 11 : 12}
            polygons={polygons}
            valueProperty="value"
            valueStops={stops}
            ariaLabel={t('title')}
            onPolygonClick={(p) => setSelected(String(p.id))}
          />
          {loading && <div className="pointer-events-none absolute inset-0 rounded-card bg-bg/40" aria-hidden />}
          <div className="absolute bottom-3 left-3 rounded-card border border-border bg-surface/95 p-3 text-small">
            <p className="mb-1.5 font-medium">
              {state.metric === 'price' ? t('metricPrice') : t('metricVacancy')} <span className="text-muted">({unit})</span>
            </p>
            <ul className="flex items-end gap-0.5" aria-label={t('legend')}>
              {legend.map((l) => (
                <li key={l.color} className="flex flex-col items-start">
                  <span className="block h-3 w-9 border border-border" style={{ background: l.color }} aria-hidden />
                  <span className="tabular text-[11px] text-muted">{formatNumber(l.from)}</span>
                </li>
              ))}
              <li className="tabular text-[11px] text-muted">{formatNumber(stops[1])}</li>
            </ul>
          </div>
        </div>
        <aside className="hidden lg:block" aria-live="polite">
          <Card className="sticky top-20 p-4">
            {sel ? (
              <>
                <h2 className="mb-3 text-h3 font-semibold">{sel.name}</h2>
                {panel}
              </>
            ) : (
              <p className="text-muted">{t('hint')}</p>
            )}
          </Card>
        </aside>
      </div>

      {!desktop && (
        <Drawer open={!!sel} onOpenChange={(o) => !o && setSelected(null)} title={sel?.name ?? ''} side="bottom">
          {panel}
        </Drawer>
      )}

      <section aria-labelledby="districts-table">
        <h2 id="districts-table" className="mb-3 text-h3 font-semibold">
          {t('table')}
        </h2>
        <Table columns={columns} rows={stats} rowKey={(s) => s.id} initialSort={{ key: state.metric === 'price' ? 'avg' : 'vacancy', dir: 'desc' }} empty={t('noData')} />
      </section>
    </div>
  );
}
