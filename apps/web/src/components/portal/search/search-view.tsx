'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { LayoutList, Map as MapIcon, Columns2, SlidersHorizontal, X, RotateCcw, SearchX } from 'lucide-react';
import {
  SEARCH_SORTS, SEARCH_SORT_LABELS_KA, filtersToParams, formatArea, formatMoney, formatNumber, type ListingCard, type SearchFilters,
} from '@lokacia/contracts';
import { Button, Drawer, EmptyState, Select, Skeleton, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { FavoritesProvider } from '../favorites';
import { ListingCardLink } from '../listing-card-link';
import { BusinessTypeIcon } from '../business-type-icon';
import { NlSearchBox } from '../nl-search';
import { FiltersPanel, type DistrictOption, type TypeOption } from './filters-panel';
import { SaveSearchButton } from './save-search-dialog';
import { activeFilterCount, filterChips, removeChip, shortPrice } from './chips';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="grid size-full min-h-64 place-items-center rounded-card border border-border bg-surface-2 text-small text-muted">…</div>,
});

type Result = { items: ListingCard[]; total: number; nextCursor: string | null };
type MapPointDto = { id: string; slug: string; lat: number; lng: number; priceMinor: number; areaM2: number; dealType: string; vip: boolean; title: string; businessType: string | null };
type View = 'list' | 'split' | 'map';

const PAGE = 24;
const withLimit = (qs: string, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams(qs);
  p.set('limit', String(PAGE));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
};

export function SearchView({
  initialFilters,
  initialResult,
  types,
  districts,
  typeNames,
  districtNames,
  loggedIn,
}: {
  initialFilters: SearchFilters;
  initialResult: Result | null;
  types: TypeOption[];
  districts: DistrictOption[];
  typeNames: Record<string, string>;
  districtNames: Record<string, string>;
  loggedIn: boolean;
}) {
  const t = useTranslations('search');
  const [filters, setFilters] = React.useState<SearchFilters>(initialFilters);
  const [result, setResult] = React.useState<Result>(initialResult ?? { items: [], total: 0, nextCursor: null });
  const [loading, setLoading] = React.useState(!initialResult);
  const [error, setError] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [view, setView] = React.useState<View>('list');
  const [drawer, setDrawer] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pendingBbox, setPendingBbox] = React.useState<[number, number, number, number] | null>(null);
  const ignoreBoundsUntil = React.useRef(0);
  const reqId = React.useRef(0);

  const qs = filtersToParams(filters).toString();
  const firstQs = React.useRef(initialResult ? qs : null);

  // Real navigations (e.g. NL search → router.push) bring new server props; refreshes with the same props are ignored,
  // so local filter state (already mirrored to the URL via replaceState) is never clobbered.
  const initialQs = filtersToParams(initialFilters).toString();
  const lastInitialQs = React.useRef(initialQs);
  React.useEffect(() => {
    if (lastInitialQs.current === initialQs) return;
    lastInitialQs.current = initialQs;
    firstQs.current = initialResult ? initialQs : null;
    setFilters(initialFilters);
    if (initialResult) {
      setResult(initialResult);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQs]);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem('lk-search-view') as View | null;
      if (v === 'split' || v === 'map') setView(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('lk-search-view', v);
    } catch {
      /* storage unavailable */
    }
  };

  const load = React.useCallback(async (query: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const r = await apiFetch<Result>(`/listings?${withLimit(query)}`);
      if (id === reqId.current) setResult({ items: r.items, total: r.total, nextCursor: r.nextCursor });
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // URL is the source of truth for sharing; replaceState avoids a server round-trip on every filter change.
  React.useEffect(() => {
    if (firstQs.current === qs) return;
    firstQs.current = null;
    window.history.replaceState(window.history.state, '', qs ? `/search?${qs}` : '/search');
    void load(qs);
  }, [qs, load]);

  const loadMore = async () => {
    if (!result.nextCursor) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const r = await apiFetch<Result>(`/listings?${withLimit(qs, { cursor: result.nextCursor })}`);
      if (id === reqId.current) setResult((s) => ({ items: [...s.items, ...r.items.filter((x) => !s.items.some((y) => y.id === x.id))], total: r.total, nextCursor: r.nextCursor }));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const patch = React.useCallback((p: Partial<Record<keyof SearchFilters, unknown>>) => {
    setFilters((f) => {
      const next = { ...f } as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) delete next[k];
        else next[k] = v;
      }
      return next as SearchFilters;
    });
  }, []);
  const reset = () => setFilters(filters.sort ? ({ sort: filters.sort } as SearchFilters) : ({} as SearchFilters));

  const { data: points } = useSWR<MapPointDto[]>(view !== 'list' ? `/listings/map?${qs}` : null, (p: string) => apiFetch<MapPointDto[]>(p), { keepPreviousData: true, revalidateOnFocus: false });
  const mapPoints = React.useMemo(() => {
    ignoreBoundsUntil.current = Date.now() + 1200;
    return (points ?? []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: shortPrice(p.priceMinor), vip: p.vip, title: p.title }));
  }, [points]);
  const selectedPoint = points?.find((p) => p.id === selected) ?? null;

  const onPointClick = (id: string) => {
    setSelected(id);
    if (view === 'split') document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const onBounds = (b: [number, number, number, number]) => {
    if (Date.now() < ignoreBoundsUntil.current) return;
    setPendingBbox(b.map((n) => Math.round(n * 10000) / 10000) as [number, number, number, number]);
  };
  const applyBbox = () => {
    if (!pendingBbox) return;
    ignoreBoundsUntil.current = Date.now() + 1500;
    patch({ bbox: pendingBbox, lat: undefined, lng: undefined, radiusM: undefined });
    setPendingBbox(null);
  };

  const chips = filterChips(filters, { typeNames, districtNames, t: (k, v) => t(k as never, v as never) });
  const active = activeFilterCount(filters);
  const showSidebar = view === 'list';

  const typeTiles = (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2" aria-label={t('businessTypes')}>
        <li>
          <TypeTile active={!filters.businessType} label={t('allTypes')} onClick={() => patch({ businessType: undefined })} />
        </li>
        {types.map((x) => (
          <li key={x.slug}>
            <TypeTile
              active={filters.businessType === x.slug}
              icon={x.icon}
              label={x.nameKa}
              onClick={() => {
                const allowed = new Set(x.filterConfig.filters.map((f) => f.key));
                const p: Record<string, unknown> = { businessType: filters.businessType === x.slug ? undefined : x.slug };
                for (const k of Object.keys(filters)) if (isPassportKey(k) && !allowed.has(k)) p[k] = undefined;
                patch(p);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  const filtersButton = (
    <Drawer
      open={drawer}
      onOpenChange={setDrawer}
      title={t('filters')}
      trigger={
        <Button variant="secondary" size="md" className={cn(showSidebar && 'lg:hidden')} icon={<SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />}>
          {t('filters')}
          {active > 0 && <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-contrast tabular">{active}</span>}
        </Button>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={reset} className="flex-1">
            {t('resetFilters')}
          </Button>
          <Button onClick={() => setDrawer(false)} className="flex-1" loading={loading}>
            {t('showResults', { count: result.total })}
          </Button>
        </div>
      }
    >
      <FiltersPanel filters={filters} onChange={patch} types={types} districts={districts} />
    </Drawer>
  );

  const viewToggle = (
    <div role="radiogroup" aria-label={t('view')} className="inline-flex h-10 overflow-hidden rounded-button border border-border-strong">
      {(
        [
          ['list', t('viewList'), LayoutList],
          ['split', t('viewSplit'), Columns2],
          ['map', t('viewMap'), MapIcon],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          title={label}
          onClick={() => changeView(v)}
          className={cn('inline-flex items-center gap-1.5 px-3 text-small transition-colors duration-150', v === 'split' && 'hidden lg:inline-flex', view === v ? 'bg-primary text-primary-contrast' : 'bg-surface hover:bg-surface-2')}
        >
          <Icon className="size-4" strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </button>
      ))}
    </div>
  );

  const cards = (
    <>
      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-card border border-danger px-4 py-3 text-danger">
          <span>{t('error')}</span>
          <Button size="sm" variant="danger" onClick={() => void load(qs)}>
            {t('retry')}
          </Button>
        </div>
      )}
      {loading && !result.items.length ? (
        <CardSkeletons count={view === 'split' ? 4 : 6} cols={view === 'split' ? 1 : 2} />
      ) : !loading && !result.items.length && !error ? (
        <EmptyState
          icon={<SearchX className="size-5" strokeWidth={1.5} aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {active > 0 && (
                <Button variant="secondary" onClick={reset} icon={<RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />}>
                  {t('resetFilters')}
                </Button>
              )}
              <SaveSearchButton filters={filters} loggedIn={loggedIn} typeNames={typeNames} districtNames={districtNames} variant="primary" />
            </div>
          }
        />
      ) : (
        <div className={cn('transition-opacity duration-150', loading && 'opacity-60')} aria-busy={loading}>
          <ul className={cn('grid gap-4', view === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'sm:grid-cols-2')}>
            {result.items.map((l, i) => (
              <li key={l.id} id={`card-${l.id}`} className={cn('flex scroll-mt-24 rounded-card', selected === l.id && 'outline-2 outline-offset-2 outline-accent')} onMouseEnter={() => view === 'split' && setSelected(l.id)}>
                <ListingCardLink listing={l} typeNames={typeNames} priority={i < 2} className="w-full" />
              </li>
            ))}
          </ul>
          {result.nextCursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" size="lg" onClick={() => void loadMore()} loading={loadingMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );

  const map = (
    <div className="relative size-full">
      <MapView points={mapPoints} fitToPoints={!filters.bbox} selectedId={selected} onPointClick={onPointClick} onBoundsChange={onBounds} ariaLabel={t('viewMap')} className="size-full min-h-0" />
      {pendingBbox && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <Button size="sm" className="pointer-events-auto" onClick={applyBbox}>
            {t('searchArea')}
          </Button>
        </div>
      )}
      {view === 'map' && selectedPoint && (
        <div className="absolute inset-x-3 bottom-3 flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-3 sm:left-auto sm:w-80">
          <div className="min-w-0">
            <Link href={`/listings/${selectedPoint.slug}`} className="line-clamp-2 font-semibold hover:text-link">
              {selectedPoint.title}
            </Link>
            <p className="mt-1 text-small text-muted tabular">
              {formatMoney(selectedPoint.priceMinor)} · {formatArea(selectedPoint.areaM2)}
            </p>
          </div>
          <button type="button" onClick={() => setSelected(null)} aria-label={t('closePreview')} className="grid size-7 shrink-0 place-items-center rounded-button text-muted hover:bg-surface-2">
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <FavoritesProvider loggedIn={loggedIn}>
      <div className={cn('mx-auto w-full px-4 py-6 md:px-6', view === 'list' ? 'max-w-[1200px]' : 'max-w-[1600px]')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-h2 font-semibold md:text-h1">{t('heading')}</h1>
              <p className="mt-1 text-muted tabular" aria-live="polite" aria-atomic="true">
                {loading ? t('countLoading') : t('count', { count: formatNumber(result.total) })}
              </p>
            </div>
            <NlSearchBox className="lg:max-w-xl" typeNames={typeNames} districtNames={districtNames} />
          </div>

          {typeTiles}

          <div className="flex flex-wrap items-center gap-2">
            {filtersButton}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="search-sort">
                {t('sort')}
              </label>
              <Select id="search-sort" className="w-48" value={filters.sort ?? 'relevance'} onChange={(e) => patch({ sort: e.target.value === 'relevance' ? undefined : e.target.value })} options={SEARCH_SORTS.map((s) => ({ value: s, label: SEARCH_SORT_LABELS_KA[s] }))} />
              {viewToggle}
              <SaveSearchButton filters={filters} loggedIn={loggedIn} typeNames={typeNames} districtNames={districtNames} />
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2" aria-label={t('filters')}>
              {chips.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setFilters(removeChip(filters, c))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border-strong bg-surface px-2.5 text-small hover:bg-surface-2"
                    aria-label={t('removeChip', { label: c.label })}
                  >
                    <span className="tabular">{c.label}</span>
                    <X className="size-3.5 text-muted" strokeWidth={1.5} aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <Button variant="link" size="sm" onClick={reset}>
                  {t('resetFilters')}
                </Button>
              </li>
            </ul>
          )}
        </div>

        <div className="mt-6">
          {view === 'list' && (
            <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
              <aside className="hidden lg:block" aria-label={t('filters')}>
                <div className="sticky top-20 max-h-[calc(100dvh-96px)] overflow-y-auto rounded-card border border-border bg-surface p-4">
                  <FiltersPanel filters={filters} onChange={patch} types={types} districts={districts} />
                </div>
              </aside>
              <section>{cards}</section>
            </div>
          )}
          {view === 'split' && (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
              <div className="h-72 lg:sticky lg:top-20 lg:order-2 lg:h-[calc(100dvh-112px)]">{map}</div>
              <section className="lg:order-1">{cards}</section>
            </div>
          )}
          {view === 'map' && <div className="h-[calc(100dvh-220px)] min-h-[420px]">{map}</div>}
        </div>
      </div>
    </FavoritesProvider>
  );
}

const PASSPORT = new Set(['powerKw', 'threePhase', 'ceilingM', 'facadeM', 'widthM', 'depthM', 'hasHood', 'hasGas', 'wetPoints', 'gateWM', 'truckAccess', 'access247', 'parking', 'shopWindow', 'separateEntrance', 'ventilation']);
const isPassportKey = (k: string) => PASSPORT.has(k);

function TypeTile({ active, label, icon, onClick }: { active: boolean; label: string; icon?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-button border px-3 text-[14px] transition-colors duration-150',
        active ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface text-text hover:border-border-strong',
      )}
    >
      {icon && <BusinessTypeIcon name={icon} className="size-4" />}
      {label}
    </button>
  );
}

export function CardSkeletons({ count = 6, cols = 2 }: { count?: number; cols?: 1 | 2 | 3 }) {
  return (
    <ul className={cn('grid gap-4', cols === 1 ? 'grid-cols-1' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-card border border-border bg-surface">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-3 h-7 w-32" />
          </div>
        </li>
      ))}
    </ul>
  );
}
