'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3 } from 'lucide-react';
import type { ListingCard } from '@lokacia/contracts';
import { Badge, Table, type Column } from '@lokacia/ui';
import { FavoritesProvider } from '../favorites';
import { ListingGrid } from '../listing-card-link';
import { useFormat } from '@/i18n/use-format';

const STATUS_TONE: Record<string, 'success' | 'outline' | 'neutral'> = { active: 'success', stale: 'outline', rented: 'neutral', sold: 'neutral' };

/** Units of an off-plan project: sortable table or card grid. */
export function UnitsView({ units, typeNames , loggedIn }: { units: ListingCard[]; typeNames: Record<string, string> ; loggedIn?: boolean }) {
  const t = useTranslations('projects');
  const f = useFormat();
  const [view, setView] = React.useState<'table' | 'cards'>('table');
  const columns: Column<ListingCard>[] = [
    { key: 'floor', header: t('col.floor'), cell: (u) => (u.floor ?? '—'), sortValue: (u) => u.floor },
    { key: 'area', header: t('col.area'), cell: (u) => `${f.number(u.areaM2)} ${f.areaUnit}`, sortValue: (u) => u.areaM2, align: 'right' },
    { key: 'deal', header: t('col.deal'), cell: (u) => f.dealType(u.dealType) },
    { key: 'price', header: t('col.price'), cell: (u) => f.money(u.priceMinor, u.currency), sortValue: (u) => u.priceMinor, align: 'right' },
    { key: 'm2', header: t('col.priceM2'), cell: (u) => f.money(Math.round(u.priceMinor / u.areaM2 / 100) * 100, u.currency), sortValue: (u) => u.priceMinor / u.areaM2, align: 'right' },
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
      <div role="group" aria-label={t('viewToggle')} className="inline-flex self-end rounded-full border border-border bg-surface-2 p-1">
        {(['table', 'cards'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-small font-semibold transition-all ${view === v ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
          >
            {v === 'table' ? <Rows3 className="size-4" strokeWidth={2} aria-hidden /> : <LayoutGrid className="size-4" strokeWidth={2} aria-hidden />}
            {v === 'table' ? t('viewTable') : t('viewCards')}
          </button>
        ))}
      </div>
      {view === 'table' ? (
        <Table columns={columns} rows={units} rowKey={(u) => u.id} initialSort={{ key: 'floor', dir: 'asc' }} />
      ) : (
        <FavoritesProvider loggedIn={loggedIn}>
          <ListingGrid listings={units} typeNames={typeNames} />
        </FavoritesProvider>
      )}
    </div>
  );
}
