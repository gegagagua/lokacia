'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatMoney, formatNumber, type ListingCard } from '@lokacia/contracts';
import { Badge, Table, type Column } from '@lokacia/ui';
import { FavoritesProvider } from '../favorites';
import { ListingGrid } from '../listing-card-link';

const STATUS_TONE: Record<string, 'success' | 'outline' | 'neutral'> = { active: 'success', stale: 'outline', rented: 'neutral', sold: 'neutral' };

/** Units of an off-plan project: sortable table or card grid. */
export function UnitsView({ units, typeNames }: { units: ListingCard[]; typeNames: Record<string, string> }) {
  const t = useTranslations('projects');
  const [view, setView] = React.useState<'table' | 'cards'>('table');
  const columns: Column<ListingCard>[] = [
    { key: 'floor', header: t('col.floor'), cell: (u) => (u.floor ?? '—'), sortValue: (u) => u.floor },
    { key: 'area', header: t('col.area'), cell: (u) => `${formatNumber(u.areaM2)} მ²`, sortValue: (u) => u.areaM2, align: 'right' },
    { key: 'deal', header: t('col.deal'), cell: (u) => DEAL_TYPE_LABELS_KA[u.dealType] },
    { key: 'price', header: t('col.price'), cell: (u) => formatMoney(u.priceMinor, u.currency), sortValue: (u) => u.priceMinor, align: 'right' },
    { key: 'm2', header: t('col.priceM2'), cell: (u) => formatMoney(Math.round(u.priceMinor / u.areaM2 / 100) * 100, u.currency), sortValue: (u) => u.priceMinor / u.areaM2, align: 'right' },
    { key: 'status', header: t('col.status'), cell: (u) => <Badge tone={STATUS_TONE[u.status] ?? 'neutral'}>{t.has(`status.${u.status}`) ? t(`status.${u.status}` as 'status.active') : u.status}</Badge> },
    {
      key: 'open',
      header: <span className="sr-only">{t('col.open')}</span>,
      cell: (u) => (
        <Link href={`/listings/${u.slug}`} className="text-link hover:underline" aria-label={`${t('col.open')}: ${u.title}`}>
          {t('col.open')}
        </Link>
      ),
      align: 'right',
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('viewToggle')} className="inline-flex self-end rounded-button border border-border-strong bg-surface p-0.5">
        {(['table', 'cards'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-small ${view === v ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text'}`}
          >
            {v === 'table' ? <Rows3 className="size-4" strokeWidth={1.5} aria-hidden /> : <LayoutGrid className="size-4" strokeWidth={1.5} aria-hidden />}
            {v === 'table' ? t('viewTable') : t('viewCards')}
          </button>
        ))}
      </div>
      {view === 'table' ? (
        <Table columns={columns} rows={units} rowKey={(u) => u.id} initialSort={{ key: 'floor', dir: 'asc' }} />
      ) : (
        <FavoritesProvider>
          <ListingGrid listings={units} typeNames={typeNames} />
        </FavoritesProvider>
      )}
    </div>
  );
}
