'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, Camera, ExternalLink, Plus, Search } from 'lucide-react';
import { formatArea, formatMoney, LISTING_STATUS_LABELS_KA, LISTING_STATUSES, relativeDaysKa, type CrmListingRow } from '@lokacia/contracts';
import { Button, EmptyState, Input, Select, Skeleton, Table, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { FeedBox } from './feed-box';
import { ListingActions } from './listing-actions';
import { ListingStatusBadge } from './status-badge';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

export function ListingsView({ initialStatus }: { initialStatus: string }) {
  const t = useTranslations('listings');
  const router = useRouter();
  const { can } = useCrm();
  const { data, isLoading, mutate } = useApi<CrmListingRow[]>('/crm/listings');
  const [status, setStatus] = React.useState(initialStatus);
  const [q, setQ] = React.useState('');

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
    return (data ?? []).filter((l) => (!status || l.status === status) && (!term || l.title.toLowerCase().includes(term) || l.address.toLowerCase().includes(term)));
  }, [data, status, q]);

  const columns: Column<CrmListingRow>[] = [
    {
      key: 'listing',
      header: t('columns.listing'),
      sortValue: (l) => l.title,
      cell: (l) => (
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-photo border border-border bg-surface-2">{l.cover ? <img src={l.cover} alt="" className="size-full object-cover" loading="lazy" /> : <Building2 className="m-3 size-5 text-muted" strokeWidth={1.5} aria-hidden />}</div>
          <div className="min-w-0">
            <Link href={`/listings/${l.id}`} className="line-clamp-1 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {l.title}
            </Link>
            <div className="line-clamp-1 text-small text-muted">
              {l.address}
              {l.districtName ? `, ${l.districtName}` : ''}
            </div>
            {l.status === 'rejected' && l.rejectReason && <div className="text-small text-danger">{t('rejectReason', { reason: l.rejectReason })}</div>}
          </div>
        </div>
      ),
    },
    { key: 'status', header: t('columns.status'), sortValue: (l) => l.status, cell: (l) => <ListingStatusBadge status={l.status} /> },
    { key: 'price', header: t('columns.price'), align: 'right', sortValue: (l) => l.priceMinor, cell: (l) => <span className="whitespace-nowrap">{formatMoney(l.priceMinor, l.currency)}</span> },
    { key: 'area', header: t('columns.area'), align: 'right', sortValue: (l) => l.areaM2, cell: (l) => <span className="whitespace-nowrap">{formatArea(l.areaM2)}</span> },
    { key: 'agent', header: t('columns.agent'), sortValue: (l) => l.agentName ?? '', cell: (l) => <span className="whitespace-nowrap text-small">{l.agentName ?? '—'}</span> },
    {
      key: 'stats',
      header: t('columns.stats'),
      align: 'right',
      sortValue: (l) => l.stats30d.views,
      cell: (l) => <span className="whitespace-nowrap text-small text-muted">{t('statsShort', l.stats30d)}</span>,
    },
    { key: 'updated', header: t('columns.updated'), sortValue: (l) => l.updatedAt, cell: (l) => <span className="whitespace-nowrap text-small text-muted">{relativeDaysKa(l.updatedAt)}</span> },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (l) => (
        <div className="flex items-center justify-end gap-1">
          <ListingActions id={l.id} status={l.status} onChanged={() => void mutate()} compact />
          {['active', 'stale', 'rented', 'sold'].includes(l.status) && (
            <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="grid size-8 place-items-center rounded-button text-muted hover:bg-surface-2" aria-label={t('openPortal')} title={t('openPortal')}>
              <ExternalLink className="size-3.5" strokeWidth={1.5} />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('listings.publish') && (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/listings/new">
                  <Camera className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {t('addOnSite')}
                </Link>
              </Button>
              <Button asChild size="sm">
                <a href={`${APP_URL}/account/listings/new`}>
                  <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {t('addWizard')}
                </a>
              </Button>
            </>
          )
        }
      />
      <FeedBox />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} prefixIcon={<Search className="size-4" strokeWidth={1.5} />} className="sm:max-w-sm sm:flex-1" />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('statusFilter')}
          className="sm:w-64"
          options={[{ value: '', label: `${t('allStatuses')} (${data?.length ?? 0})` }, ...LISTING_STATUSES.map((s) => ({ value: s, label: `${LISTING_STATUS_LABELS_KA[s]} (${counts.get(s) ?? 0})` }))]}
        />
        <span className="text-small text-muted sm:ml-auto" aria-live="polite">
          {t('count', { count: rows.length })}
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Building2 className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(l) => l.id} onRowClick={(l) => router.push(`/listings/${l.id}`)} initialSort={{ key: 'updated', dir: 'desc' }} />
      )}
    </div>
  );
}
