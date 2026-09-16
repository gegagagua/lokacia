'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bookmark, Building2, Camera, CircleCheck, ExternalLink, Eye, Hourglass, LayoutGrid, List, Phone, Plus, Ruler, Search } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatArea, formatMoney, formatNumber, LISTING_STATUS_LABELS_KA, LISTING_STATUSES, relativeDaysKa, type CrmListingRow } from '@lokacia/contracts';
import { Button, EmptyState, Input, Skeleton, Table, VipBadge, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ChipGroup, PersonAvatar, Segmented, StatCard } from '@/components/common/ui';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { FeedBox } from './feed-box';
import { ListingActions } from './listing-actions';
import { LISTING_STATUS_TONE, ListingStatusBadge } from './status-badge';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
const VIEW_KEY = 'lk-crm-listings-view';
const PUBLIC = ['active', 'stale', 'rented', 'sold'];

function PortalLink({ l, label, className }: { l: CrmListingRow; label: string; className?: string }) {
  if (!PUBLIC.includes(l.status)) return null;
  return (
    <a
      href={`${APP_URL}/listings/${l.slug}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'grid size-9 place-items-center rounded-button text-muted transition-colors hover:bg-surface-2 hover:text-text'}
      aria-label={label}
      title={label}
    >
      <ExternalLink className="size-4" strokeWidth={2} />
    </a>
  );
}

function ListingGridCard({ l, onChanged }: { l: CrmListingRow; onChanged: () => void }) {
  const t = useTranslations('listings');
  return (
    <li className="card card-hover group relative flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {l.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.cover} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="drawing-grid grid size-full place-items-center text-muted">
            <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <ListingStatusBadge status={l.status} overlay />
          {l.vip && <VipBadge />}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
          <span className="text-[20px] font-bold leading-6 tracking-tight tabular drop-shadow-sm">
            {formatMoney(l.priceMinor, l.currency)}
            {l.pricePeriod === 'month' && <span className="ml-1 text-[13px] font-medium opacity-85">/ {t('grid.perMonth')}</span>}
          </span>
          <span className="shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-[12.5px] font-semibold backdrop-blur-sm">{DEAL_TYPE_LABELS_KA[l.dealType]}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/listings/${l.id}`} className="line-clamp-2 text-[15.5px] font-semibold leading-6 after:absolute after:inset-0 after:content-[''] hover:text-primary-soft-text focus-visible:outline-none">
          {l.title}
        </Link>
        <p className="line-clamp-1 text-[13.5px] text-muted">
          {l.address}
          {l.districtName ? `, ${l.districtName}` : ''}
        </p>
        {l.status === 'rejected' && l.rejectReason && <p className="rounded-xl bg-danger/10 px-2.5 py-1.5 text-[13px] text-danger">{t('rejectReason', { reason: l.rejectReason })}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1 font-medium text-text tabular">
            <Ruler className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
            {formatArea(l.areaM2)}
          </span>
          {l.agentName && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PersonAvatar name={l.agentName} size={20} />
              <span className="truncate">{l.agentName}</span>
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <dl className="flex min-w-0 flex-1 items-center gap-3 text-[12.5px] text-muted tabular" aria-label={t('columns.stats')}>
            <div className="inline-flex items-center gap-1" title={t('detail.views')}>
              <dt className="sr-only">{t('detail.views')}</dt>
              <Eye className="size-3.5" strokeWidth={2} aria-hidden />
              <dd>{formatNumber(l.stats30d.views)}</dd>
            </div>
            <div className="inline-flex items-center gap-1" title={t('detail.reveals')}>
              <dt className="sr-only">{t('detail.reveals')}</dt>
              <Phone className="size-3.5" strokeWidth={2} aria-hidden />
              <dd>{formatNumber(l.stats30d.reveals)}</dd>
            </div>
            <div className="inline-flex items-center gap-1" title={t('detail.saves')}>
              <dt className="sr-only">{t('detail.saves')}</dt>
              <Bookmark className="size-3.5" strokeWidth={2} aria-hidden />
              <dd>{formatNumber(l.stats30d.saves)}</dd>
            </div>
          </dl>
          <div className="relative z-10 flex items-center gap-0.5">
            <ListingActions id={l.id} status={l.status} onChanged={onChanged} compact />
            <PortalLink l={l} label={t('openPortal')} />
          </div>
        </div>
      </div>
    </li>
  );
}

export function ListingsView({ initialStatus }: { initialStatus: string }) {
  const t = useTranslations('listings');
  const router = useRouter();
  const { can } = useCrm();
  const { data, isLoading, mutate } = useApi<CrmListingRow[]>('/crm/listings');
  const [status, setStatus] = React.useState(initialStatus);
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'table'>('grid');

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'grid' || v === 'table') setView(v);
    } catch {
      /* private mode */
    }
  }, []);
  const changeView = (v: 'grid' | 'table') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode */
    }
  };

  React.useEffect(() => {
    window.history.replaceState(null, '', status ? `/listings?status=${status}` : '/listings');
  }, [status]);

  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of data ?? []) m.set(l.status, (m.get(l.status) ?? 0) + 1);
    return m;
  }, [data]);

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? [])
      .filter((l) => (!status || l.status === status) && (!term || l.title.toLowerCase().includes(term) || l.address.toLowerCase().includes(term)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [data, status, q]);

  const totals = React.useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      active: counts.get('active') ?? 0,
      review: (counts.get('pending_review') ?? 0) + (counts.get('draft') ?? 0),
      views: all.reduce((s, l) => s + l.stats30d.views, 0),
    };
  }, [data, counts]);

  const columns: Column<CrmListingRow>[] = [
    {
      key: 'listing',
      header: t('columns.listing'),
      sortValue: (l) => l.title,
      cell: (l) => (
        <div className="flex min-w-[260px] items-center gap-3">
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
            {l.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.cover} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <Building2 className="m-3.5 size-5 text-muted" strokeWidth={2} aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <Link href={`/listings/${l.id}`} className="line-clamp-1 font-semibold hover:text-primary-soft-text" onClick={(e) => e.stopPropagation()}>
              {l.title}
            </Link>
            <div className="line-clamp-1 text-[13px] text-muted">
              {l.address}
              {l.districtName ? `, ${l.districtName}` : ''}
            </div>
            {l.status === 'rejected' && l.rejectReason && <div className="text-[13px] text-danger">{t('rejectReason', { reason: l.rejectReason })}</div>}
          </div>
        </div>
      ),
    },
    { key: 'status', header: t('columns.status'), sortValue: (l) => l.status, cell: (l) => <ListingStatusBadge status={l.status} /> },
    { key: 'price', header: t('columns.price'), align: 'right', sortValue: (l) => l.priceMinor, cell: (l) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(l.priceMinor, l.currency)}</span> },
    { key: 'area', header: t('columns.area'), align: 'right', sortValue: (l) => l.areaM2, cell: (l) => <span className="whitespace-nowrap tabular">{formatArea(l.areaM2)}</span> },
    {
      key: 'agent',
      header: t('columns.agent'),
      sortValue: (l) => l.agentName ?? '',
      cell: (l) =>
        l.agentName ? (
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[14px]">
            <PersonAvatar name={l.agentName} size={24} />
            {l.agentName}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'stats',
      header: t('columns.stats'),
      align: 'right',
      sortValue: (l) => l.stats30d.views,
      cell: (l) => <span className="whitespace-nowrap text-[13px] text-muted tabular">{t('statsShort', l.stats30d)}</span>,
    },
    { key: 'updated', header: t('columns.updated'), sortValue: (l) => l.updatedAt, cell: (l) => <span className="whitespace-nowrap text-[13px] text-muted">{relativeDaysKa(l.updatedAt)}</span> },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (l) => (
        <div className="flex items-center justify-end gap-1">
          <ListingActions id={l.id} status={l.status} onChanged={() => void mutate()} compact />
          <PortalLink l={l} label={t('openPortal')} />
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: '', label: t('allStatuses'), count: data?.length ?? 0 },
    ...LISTING_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0 || s === status).map((s) => ({ value: s, label: LISTING_STATUS_LABELS_KA[s], count: counts.get(s) ?? 0, tone: LISTING_STATUS_TONE[s] })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className="mb-0"
        actions={
          can('listings.publish') && (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/listings/new">
                  <Camera className="size-4" strokeWidth={2} aria-hidden />
                  {t('addOnSite')}
                </Link>
              </Button>
              <Button asChild size="sm">
                <a href={`${APP_URL}/account/listings/new`}>
                  <Plus className="size-4" strokeWidth={2.4} aria-hidden />
                  {t('addWizard')}
                </a>
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label={t('kpi.total')} value={data ? formatNumber(totals.total) : '—'} icon={Building2} tone={2} />
        <StatCard label={t('kpi.active')} value={data ? formatNumber(totals.active) : '—'} icon={CircleCheck} tone="success" />
        <StatCard label={t('kpi.review')} value={data ? formatNumber(totals.review) : '—'} icon={Hourglass} tone={3} />
        <StatCard label={t('kpi.views')} value={data ? formatNumber(totals.views) : '—'} icon={Eye} tone={4} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} prefixIcon={<Search className="size-4" strokeWidth={2} />} className="sm:max-w-sm sm:flex-1" />
          <div className="flex items-center gap-3 sm:ml-auto">
            <span className="text-[13.5px] font-medium text-muted tabular" aria-live="polite">
              {t('count', { count: rows.length })}
            </span>
            <Segmented
              label={t('grid.view')}
              value={view}
              onChange={changeView}
              className="ml-auto"
              options={[
                { value: 'grid', label: t('grid.cards'), icon: LayoutGrid },
                { value: 'table', label: t('grid.table'), icon: List },
              ]}
            />
          </div>
        </div>
        <ChipGroup label={t('statusFilter')} value={status} onChange={setStatus} options={statusOptions} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Building2 className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
      ) : view === 'grid' ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label={t('title')}>
          {rows.map((l) => (
            <ListingGridCard key={l.id} l={l} onChanged={() => void mutate()} />
          ))}
        </ul>
      ) : (
        <Table columns={columns} rows={rows} rowKey={(l) => l.id} onRowClick={(l) => router.push(`/listings/${l.id}`)} initialSort={{ key: 'updated', dir: 'desc' }} className="card overflow-hidden" />
      )}

      <FeedBox />
    </div>
  );
}
