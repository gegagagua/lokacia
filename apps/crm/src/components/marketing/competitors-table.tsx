'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, History, Plus, Radar, RefreshCw, Trash2 } from 'lucide-react';
import { detectPortal, formatDateTimeKa, formatMoney, type CompetitorPriceChange, type CompetitorTrackRow } from '@lokacia/contracts';
import { Badge, Button, Dialog, Drawer, EmptyState, Field, Input, Skeleton, Table, useToast, type Column } from '@lokacia/ui';
import { ListingPicker } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PriceHistoryChart } from './price-history';

const STATUS_TONE = { active: 'success', removed: 'outline', error: 'danger' } as const;

export function CompetitorsTable({ listingId, openAdd = false }: { listingId?: string; openAdd?: boolean }) {
  const t = useTranslations('marketing.competitors');
  const toast = useToast();
  const { can } = useCrm();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<CompetitorTrackRow[]>(listingId ? `/crm/competitors?listingId=${listingId}` : '/crm/competitors');
  const [adding, setAdding] = React.useState(openAdd);
  const [history, setHistory] = React.useState<CompetitorTrackRow | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const check = async (row: CompetitorTrackRow) => {
    setBusy(row.id);
    try {
      await mutateApi(`/crm/competitors/${row.id}/check`);
      toast({ title: t('checked'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: CompetitorTrackRow) => {
    try {
      await mutateApi(`/crm/competitors/${row.id}`, { method: 'DELETE' });
      toast({ title: t('removed'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  const delta = (r: CompetitorTrackRow) => {
    if (r.lastPriceMinor === null || r.listingPriceMinor === null) return <span className="text-muted">—</span>;
    const diff = r.lastPriceMinor - r.listingPriceMinor;
    if (diff === 0) return <span className="text-muted">{t('same')}</span>;
    return diff < 0 ? <span className="text-danger">{t('cheaper', { amount: formatMoney(-diff) })}</span> : <span className="text-success">{t('pricier', { amount: formatMoney(diff) })}</span>;
  };

  const columns: Column<CompetitorTrackRow>[] = [
    { key: 'portal', header: t('columns.portal'), sortValue: (r) => r.portal, cell: (r) => <span className="font-medium">{r.portal}</span> },
    {
      key: 'url',
      header: t('columns.url'),
      cell: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-[220px] items-center gap-1 truncate text-small text-link hover:underline">
          <span className="truncate">{r.url.replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} aria-hidden />
        </a>
      ),
    },
    ...(!listingId
      ? [
          {
            key: 'listing',
            header: t('columns.listing'),
            sortValue: (r: CompetitorTrackRow) => r.listingTitle ?? '',
            cell: (r: CompetitorTrackRow) =>
              r.listingId ? (
                <Link href={`/listings/${r.listingId}`} className="line-clamp-1 max-w-[220px] text-small hover:underline">
                  {r.listingTitle}
                </Link>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
        ]
      : []),
    { key: 'price', header: t('columns.price'), align: 'right', sortValue: (r) => r.lastPriceMinor, cell: (r) => <span className="whitespace-nowrap">{r.lastPriceMinor !== null ? formatMoney(r.lastPriceMinor) : '—'}</span> },
    { key: 'delta', header: t('columns.delta'), cell: (r) => <span className="whitespace-nowrap text-small">{delta(r)}</span> },
    { key: 'checked', header: t('columns.checked'), sortValue: (r) => r.lastCheckedAt, cell: (r) => <span className="whitespace-nowrap text-small text-muted">{r.lastCheckedAt ? formatDateTimeKa(r.lastCheckedAt) : '—'}</span> },
    { key: 'status', header: t('columns.status'), sortValue: (r) => r.status, cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`statuses.${r.status}`)}</Badge> },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => check(r)} loading={busy === r.id} aria-label={t('check')} title={t('check')} icon={<RefreshCw className="size-3.5" strokeWidth={1.5} aria-hidden />} />
          <Button size="sm" variant="ghost" onClick={() => setHistory(r)} aria-label={t('history')} title={t('history')} icon={<History className="size-3.5" strokeWidth={1.5} aria-hidden />}>
            <span className="tabular text-small text-muted">{r.changesCount}</span>
          </Button>
          {can('records.delete') && <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label={t('remove')} title={t('remove')} icon={<Trash2 className="size-3.5 text-danger" strokeWidth={1.5} aria-hidden />} />}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted">{t('tos')}</p>
        <Button size="sm" onClick={() => setAdding(true)} icon={<Plus className="size-3.5" strokeWidth={1.5} aria-hidden />}>
          {t('add')}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<Radar className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <Table columns={columns} rows={data} rowKey={(r) => r.id} initialSort={{ key: 'checked', dir: 'desc' }} />
      )}
      {adding && <AddTrackDialog listingId={listingId} onClose={() => setAdding(false)} onCreated={() => void mutate()} />}
      <Drawer open={!!history} onOpenChange={(o) => !o && setHistory(null)} title={t('history')}>
        {history && <HistoryBody track={history} />}
      </Drawer>
    </div>
  );
}

function HistoryBody({ track }: { track: CompetitorTrackRow }) {
  const t = useTranslations('marketing.competitors');
  const { data } = useApi<CompetitorPriceChange[]>(`/crm/competitors/${track.id}/changes`);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-medium">{track.portal}</div>
        <a href={track.url} target="_blank" rel="noreferrer noopener" className="break-all text-small text-link hover:underline">
          {track.url}
        </a>
        {track.listingTitle && <div className="mt-1 text-small text-muted">{track.listingTitle}</div>}
      </div>
      {!data ? (
        <Skeleton className="h-32" />
      ) : data.length === 0 ? (
        <p className="text-small text-muted">{t('noHistory')}</p>
      ) : (
        <>
          <PriceHistoryChart changes={data} ourPriceMinor={track.listingPriceMinor} label={t('history')} />
          <ol className="flex flex-col">
            {data.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2 border-b border-border py-2 text-small last:border-b-0">
                <span className="text-muted tabular">{formatDateTimeKa(c.createdAt)}</span>
                <span className="tabular">
                  {c.oldPriceMinor !== null ? <span className="text-muted line-through">{formatMoney(c.oldPriceMinor)}</span> : null} <span className="font-medium">{formatMoney(c.newPriceMinor)}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function AddTrackDialog({ listingId, onClose, onCreated }: { listingId?: string; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('marketing.competitors');
  const toast = useToast();
  const mutate = useApiMutation();
  const [url, setUrl] = React.useState('');
  const [listing, setListing] = React.useState<string | null>(listingId ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const portal = /^https?:\/\/\S+\.\S+/.test(url) ? detectPortal(url) : '';
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mutate('/crm/competitors', { body: { url: url.trim(), listingId: listing } });
      toast({ title: t('form.created'), tone: 'success' });
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('add')}
      footer={
        <Button onClick={() => submit()} loading={busy} disabled={!url.trim()}>
          {t('form.submit')}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('form.url')} error={error} hint={portal ? `${t('form.portal')}: ${portal}` : t('form.portalHint')}>
          <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('form.urlPlaceholder')} autoFocus required />
        </Field>
        {!listingId && (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t('form.listing')}</span>
            <ListingPicker value={listing} onChange={(id) => setListing(id)} />
          </div>
        )}
      </form>
    </Dialog>
  );
}
