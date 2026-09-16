'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, LayoutList, Map as MapIcon, Columns2, SlidersHorizontal, X, RotateCcw, SearchX } from 'lucide-react';
import {
  SEARCH_SORTS, filtersToParams, type ListingCard, type SearchFilters,
} from '@lokacia/contracts';
import { Button, Drawer, EmptyState, Select, Skeleton, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { FavoritesProvider } from '../favorites';
import { ListingCardLink } from '../listing-card-link';
import { BusinessTypeIcon } from '../business-type-icon';
import { NlSearchBox } from '../nl-search';
import { FiltersPanel, type DistrictOption, type TypeOption } from './filters-panel';
import { SaveSearchButton } from './save-search-dialog';
import { activeFilterCount, filterChips, removeChip, shortPrice } from './chips';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="grid size-full min-h-64 animate-pulse place-items-center rounded-card bg-surface-3 text-small text-muted">…</div>,
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
  const fmt = useFormat();
  const [filters, setFilters] = React.useState<SearchFilters>(initialFilters);
  const [result, setResult] = React.useState<Result>(initialResult ?? { items: [], total: 0, nextCursor: null });
  const [loading, setLoading] = React.useState(!initialResult);
  const [error, setError] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [view, setView] = React.useState<View>('list');
  const [drawer, setDrawer] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [desktop, setDesktop] = React.useState(false);
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
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

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

  const chips = filterChips(filters, { typeNames, districtNames, t: (k, v) => t(k as never, v as never), fmt });
  const active = activeFilterCount(filters);
  const showSidebar = view === 'list';

  const chipScroller = React.useRef<HTMLUListElement>(null);
  const scrollChips = (dir: 1 | -1) => chipScroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  const typeTiles = (
    <div className="relative">
      <ul
        ref={chipScroller}
        className="-mx-4 flex gap-2 overflow-x-auto scroll-smooth px-4 py-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-40px),transparent)] [scrollbar-width:none] md:mx-0 md:px-10 md:[mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%-48px),transparent)] [&::-webkit-scrollbar]:hidden"
        aria-label={t('businessTypes')}
      >
        <li className="shrink-0">
          <TypeTile active={!filters.businessType} label={t('allTypes')} onClick={() => patch({ businessType: undefined })} />
        </li>
        {types.map((x) => (
          <li key={x.slug} className="shrink-0">
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
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => scrollChips(dir)}
          className={cn('absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:text-text md:grid', dir === -1 ? 'left-0' : 'right-0')}
        >
          {dir === -1 ? <ChevronLeft className="size-4" strokeWidth={2} /> : <ChevronRight className="size-4" strokeWidth={2} />}
        </button>
      ))}
    </div>
  );

  const filtersButton = (
    <Drawer
      open={drawer}
      onOpenChange={setDrawer}
      title={t('filters')}
      side={desktop ? 'right' : 'bottom'}
      className={desktop ? undefined : 'max-h-[88dvh] shadow-lg'}
      trigger={
        <Button variant="secondary" size="md" className={cn('h-10 rounded-full px-3 sm:px-4', showSidebar && 'lg:hidden')} icon={<SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden />}>
          <span className="hidden sm:inline">{t('filters')}</span>
          <span className="sr-only sm:hidden">{t('filters')}</span>
          {active > 0 && <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11.5px] font-bold text-primary-contrast tabular">{active}</span>}
        </Button>
      }
      footer={
        <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button variant="secondary" onClick={reset} className="shrink-0 rounded-full px-3.5" aria-label={t('resetFilters')} title={t('resetFilters')}>
            <RotateCcw className="size-4" strokeWidth={2} aria-hidden />
          </Button>
          <Button onClick={() => setDrawer(false)} className="min-w-0 flex-1 rounded-full" loading={loading}>
            {t('showResults', { count: result.total })}
          </Button>
        </div>
      }
    >
      <FiltersPanel filters={filters} onChange={patch} types={types} districts={districts} />
    </Drawer>
  );

  const viewToggle = (
    <div role="radiogroup" aria-label={t('view')} className="inline-flex h-10 items-center gap-0.5 rounded-full bg-surface-3/70 p-1">
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
          className={cn(
            'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:shadow-ring',
            v === 'split' && 'hidden lg:inline-flex',
            view === v ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          <Icon className="size-4" strokeWidth={2} aria-hidden />
          <span className="hidden xl:inline">{label}</span>
          <span className="sr-only xl:hidden">{label}</span>
        </button>
      ))}
    </div>
  );

  const cards = (
    <>
      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 font-medium text-danger">
          <span>{t('error')}</span>
          <Button size="sm" variant="danger" onClick={() => void load(qs)}>
            {t('retry')}
          </Button>
        </div>
      )}
      {loading && !result.items.length ? (
        <CardSkeletons count={view === 'split' ? 4 : 6} cols={view === 'split' ? 2 : 3} />
      ) : !loading && !result.items.length && !error ? (
        <EmptyState
          className="py-20"
          icon={<SearchX className="size-6" strokeWidth={2} aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {active > 0 && (
                <Button variant="secondary" className="rounded-full" onClick={reset} icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />}>
                  {t('resetFilters')}
                </Button>
              )}
              <SaveSearchButton filters={filters} loggedIn={loggedIn} typeNames={typeNames} districtNames={districtNames} variant="primary" />
            </div>
          }
        />
      ) : (
        <div className={cn('transition-opacity duration-200', loading && 'opacity-60')} aria-busy={loading}>
          <ul className={cn('grid gap-5', view === 'split' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 min-[112rem]:grid-cols-2' : 'sm:grid-cols-2 min-[85rem]:grid-cols-3')}>
            {result.items.map((l, i) => (
              <li
                key={l.id}
                id={`card-${l.id}`}
                className={cn('flex min-w-0 scroll-mt-40 rounded-card transition-shadow duration-200', selected === l.id && view === 'split' && 'shadow-[0_0_0_3px_var(--accent)]')}
                onMouseEnter={() => view === 'split' && setSelected(l.id)}
              >
                <ListingCardLink listing={l} typeNames={typeNames} priority={i < 3} layout={view === 'split' && desktop ? 'row' : 'grid'} className="w-full" />
              </li>
            ))}
          </ul>
          {result.nextCursor && (
            <div className="mt-10 flex justify-center">
              <Button variant="secondary" size="lg" className="rounded-full px-8" onClick={() => void loadMore()} loading={loadingMore}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );

  const selectedCard = selectedPoint ? result.items.find((l) => l.id === selectedPoint.id) : undefined;
  const map = (
    <div className="relative size-full overflow-hidden rounded-card border border-border bg-surface-2 shadow-sm">
      <MapView points={mapPoints} fitToPoints={!filters.bbox} selectedId={selected} onPointClick={onPointClick} onBoundsChange={onBounds} ariaLabel={t('viewMap')} className="size-full min-h-0" />
      {pendingBbox && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <Button size="sm" className="pointer-events-auto h-10 rounded-full px-5 shadow-lg" onClick={applyBbox}>
            {t('searchArea')}
          </Button>
        </div>
      )}
      {selectedPoint && (
        <div className="glass absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border border-border p-2.5 pr-3 shadow-lg sm:left-auto sm:right-4 sm:w-[360px] lg:bottom-4">
          <div className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-3 text-muted">
            {selectedCard?.cover ? <img src={selectedCard.cover} alt="" className="size-full object-cover" /> : <Building2 className="size-6" strokeWidth={2} aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-tight tracking-tight tabular">{fmt.money(selectedPoint.priceMinor)}</p>
            <Link href={`/listings/${selectedPoint.slug}`} className="mt-0.5 line-clamp-1 text-[14px] font-semibold hover:text-link">
              {selectedPoint.title}
            </Link>
            <p className="text-small text-muted tabular">{fmt.area(selectedPoint.areaM2)}</p>
          </div>
          <div className="flex flex-col items-center gap-1 self-stretch">
            <button type="button" onClick={() => setSelected(null)} aria-label={t('closePreview')} className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
              <X className="size-4" strokeWidth={2} aria-hidden />
            </button>
            <Link href={`/listings/${selectedPoint.slug}`} aria-label={t('openListing')} className="mt-auto grid size-8 place-items-center rounded-full bg-primary text-primary-contrast transition-transform hover:scale-105">
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  const wide = view === 'list' ? 'max-w-[1440px]' : 'max-w-[1680px]';

  return (
    <FavoritesProvider loggedIn={loggedIn}>
      {/* Header band */}
      <div className="border-b border-border bg-surface">
        <div className={cn('mx-auto w-full px-4 pb-4 pt-6 md:px-8 md:pt-8', wide)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[34px] lg:whitespace-nowrap">{t('heading')}</h1>
            </div>
            <NlSearchBox className="lg:max-w-[560px]" typeNames={typeNames} districtNames={districtNames} />
          </div>
          <div className="mt-5">{typeTiles}</div>
        </div>
      </div>

      {/* Sticky results toolbar */}
      <div className="glass sticky top-[72px] z-30 border-b border-border/70">
        <div className={cn('mx-auto flex w-full flex-wrap items-center gap-2 px-4 py-3 md:px-8', wide)}>
          {filtersButton}
          <p className="mr-auto hidden whitespace-nowrap pl-1 text-[15px] font-semibold tabular sm:block" aria-hidden>
            {loading ? <span className="text-muted">{t('countLoading')}</span> : t('count', { count: fmt.number(result.total) })}
          </p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {loading ? t('countLoading') : t('count', { count: fmt.number(result.total) })}
          </p>
          <label className="sr-only" htmlFor="search-sort">
            {t('sort')}
          </label>
          <Select id="search-sort" className="h-10 min-w-0 flex-1 rounded-full pl-3.5 text-[14.5px] sm:w-52 sm:flex-none" value={filters.sort ?? 'relevance'} onChange={(e) => patch({ sort: e.target.value === 'relevance' ? undefined : e.target.value })} options={SEARCH_SORTS.map((s) => ({ value: s, label: fmt.sort(s) }))} />
          {viewToggle}
          <SaveSearchButton compact filters={filters} loggedIn={loggedIn} typeNames={typeNames} districtNames={districtNames} className="h-10 rounded-full px-3 sm:px-4" />
        </div>
        {chips.length > 0 && (
          <div className={cn('mx-auto w-full px-4 pb-3 md:px-8', wide)}>
            <ul className="flex flex-wrap items-center gap-2" aria-label={t('filters')}>
              {chips.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setFilters(removeChip(filters, c))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft pl-3 pr-2 text-[13.5px] font-medium text-primary-soft-text transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:shadow-ring"
                    aria-label={t('removeChip', { label: c.label })}
                  >
                    <span className="tabular">{c.label}</span>
                    <X className="size-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[13.5px] font-semibold text-link hover:underline">
                  <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden />
                  {t('resetFilters')}
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className={cn('mx-auto w-full px-4 py-6 md:px-8 md:py-8', wide)}>
        <p className="-mt-1 mb-4 text-[15px] font-semibold tabular sm:hidden" aria-hidden>
          {loading ? <span className="text-muted">{t('countLoading')}</span> : t('count', { count: fmt.number(result.total) })}
        </p>
        {view === 'list' && (
          <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
            <aside className="hidden lg:block" aria-label={t('filters')}>
              <div className={cn('card sticky flex max-h-[calc(100dvh-180px)] flex-col overflow-hidden', chips.length ? 'top-[196px]' : 'top-[156px]')}>
                <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                  <span className="inline-flex items-center gap-2 text-[17px] font-bold">
                    <SlidersHorizontal className="size-[18px] text-primary-500" strokeWidth={2} aria-hidden />
                    {t('filters')}
                    {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11.5px] font-bold text-primary-contrast tabular">{active}</span>}
                  </span>
                  {active > 0 && (
                    <button type="button" onClick={reset} title={t('resetFilters')} aria-label={t('resetFilters')} className="grid size-8 place-items-center rounded-full text-link transition-colors hover:bg-link/10 focus-visible:outline-none focus-visible:shadow-ring">
                      <RotateCcw className="size-4" strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
                  <FiltersPanel filters={filters} onChange={patch} types={types} districts={districts} />
                </div>
              </div>
            </aside>
            <section aria-label={t('heading')}>{cards}</section>
          </div>
        )}
        {view === 'split' && (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-6">
            <div className="h-72 lg:sticky lg:top-[156px] lg:order-2 lg:h-[calc(100dvh-180px)]">{map}</div>
            <section className="lg:order-1" aria-label={t('heading')}>
              {cards}
            </section>
          </div>
        )}
        {view === 'map' && <div className="h-[calc(100dvh-250px)] min-h-[440px]">{map}</div>}
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
        'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border pl-2 pr-4 text-[14.5px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:shadow-ring',
        !icon && 'pl-4',
        active ? 'border-primary bg-primary text-primary-contrast shadow-sm' : 'border-border bg-surface text-text hover:-translate-y-px hover:border-border-strong hover:shadow-xs',
      )}
    >
      {icon && (
        <span className={cn('grid size-7 place-items-center rounded-full', active ? 'bg-primary-contrast/15' : 'bg-primary-soft text-primary-soft-text')}>
          <BusinessTypeIcon name={icon} className="size-4" />
        </span>
      )}
      {label}
    </button>
  );
}

export function CardSkeletons({ count = 6, cols = 2 }: { count?: number; cols?: 1 | 2 | 3 }) {
  return (
    <ul className={cn('grid gap-5', cols === 1 ? 'grid-cols-1' : cols === 3 ? 'sm:grid-cols-2 min-[85rem]:grid-cols-3' : 'sm:grid-cols-2')} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-card border border-border bg-surface shadow-xs">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="flex flex-col gap-2.5 p-5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-3 h-7 w-40 rounded-lg" />
          </div>
        </li>
      ))}
    </ul>
  );
}
