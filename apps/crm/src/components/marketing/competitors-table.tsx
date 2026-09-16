'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Equal, ExternalLink, History, Info, Plus, Radar, RefreshCw, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { detectPortal, formatDateTimeKa, formatMoney, type CompetitorPriceChange, type CompetitorTrackRow } from '@lokacia/contracts';
import { Button, Dialog, Drawer, EmptyState, Field, Input, Skeleton, Table, useToast, type Column } from '@lokacia/ui';
import { IconTile, Pill, StatCard, toneFor, type Tone } from '@/components/common/ui';
import { ListingPicker } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PriceHistoryChart } from './price-history';

const STATUS_TONE: Record<CompetitorTrackRow['status'], Tone> = { active: 'success', removed: 'neutral', error: 'danger' };

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

  const diffOf = (r: CompetitorTrackRow) => (r.lastPriceMinor === null || r.listingPriceMinor === null ? null : r.lastPriceMinor - r.listingPriceMinor);
  const delta = (r: CompetitorTrackRow) => {
    const diff = diffOf(r);
    if (diff === null) return <span className="text-muted">—</span>;
    if (diff === 0)
      return (
        <Pill tone="neutral" icon={Equal}>
          {t('same')}
        </Pill>
      );
    return diff < 0 ? (
      <Pill tone="danger" icon={ArrowDownRight}>
        {t('cheaper', { amount: formatMoney(-diff) })}
      </Pill>
    ) : (
      <Pill tone="success" icon={ArrowUpRight}>
        {t('pricier', { amount: formatMoney(diff) })}
      </Pill>
    );
  };

  const columns: Column<CompetitorTrackRow>[] = [
    {
      key: 'portal',
      header: t('columns.portal'),
      sortValue: (r) => r.portal,
      cell: (r) => (
        <span className="inline-flex items-center gap-2.5 whitespace-nowrap font-semibold">
          <span className={`grid size-8 place-items-center rounded-[10px] bg-tone-soft text-[13px] font-bold uppercase text-tone-ink tone-${toneFor(r.portal)}`} aria-hidden>
            {r.portal.charAt(0)}
          </span>
          {r.portal}
        </span>
      ),
    },
    {
      key: 'url',
      header: t('columns.url'),
      cell: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-[220px] items-center gap-1 truncate text-[13.5px] text-link hover:underline">
          <span className="truncate">{r.url.replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
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
                <Link href={`/listings/${r.listingId}`} className="line-clamp-1 max-w-[220px] text-[13.5px] font-medium hover:text-primary-soft-text">
                  {r.listingTitle}
                </Link>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
        ]
      : []),
    { key: 'price', header: t('columns.price'), align: 'right', sortValue: (r) => r.lastPriceMinor, cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold tabular">{r.lastPriceMinor !== null ? formatMoney(r.lastPriceMinor) : '—'}</div>
          {r.listingPriceMinor !== null && <div className="text-[12px] text-muted tabular">{t('ours', { amount: formatMoney(r.listingPriceMinor) })}</div>}
        </div>
      ),
    },
    { key: 'delta', header: t('columns.delta'), sortValue: (r) => diffOf(r), cell: (r) => delta(r) },
    { key: 'checked', header: t('columns.checked'), sortValue: (r) => r.lastCheckedAt, cell: (r) => <span className="whitespace-nowrap text-[13px] text-muted tabular">{r.lastCheckedAt ? formatDateTimeKa(r.lastCheckedAt) : '—'}</span> },
    { key: 'status', header: t('columns.status'), sortValue: (r) => r.status, cell: (r) => (
        <Pill tone={STATUS_TONE[r.status]} dot>
          {t(`statuses.${r.status}`)}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => check(r)} loading={busy === r.id} aria-label={t('check')} title={t('check')} icon={<RefreshCw className="size-4" strokeWidth={2} aria-hidden />} />
          <Button size="sm" variant="ghost" onClick={() => setHistory(r)} aria-label={t('history')} title={t('history')} icon={<History className="size-4" strokeWidth={2} aria-hidden />}>
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-semibold tabular ${r.changesCount ? 'bg-primary-soft text-primary-soft-text' : 'bg-surface-2 text-muted'}`}>{r.changesCount}</span>
          </Button>
          {can('records.delete') && <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label={t('remove')} title={t('remove')} icon={<Trash2 className="size-4 text-danger" strokeWidth={2} aria-hidden />} />}
        </div>
      ),
    },
  ];

  const rows = data ?? [];
  const cheaper = rows.filter((r) => (diffOf(r) ?? 0) < 0).length;
  const pricier = rows.filter((r) => (diffOf(r) ?? 0) > 0).length;
  const changes = rows.reduce((sum, r) => sum + r.changesCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {!listingId && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label={t('kpi.tracks')} value={rows.length} icon={Radar} tone={4} />
          <StatCard label={t('kpi.cheaper')} value={cheaper} icon={TrendingDown} tone="danger" />
          <StatCard label={t('kpi.pricier')} value={pricier} icon={TrendingUp} tone="success" />
          <StatCard label={t('kpi.changes')} value={changes} icon={History} tone={2} />
        </div>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-[13.5px] text-muted">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          {t('tos')}
        </p>
        <Button size="sm" onClick={() => setAdding(true)} icon={<Plus className="size-4" strokeWidth={2.4} aria-hidden />}>
          {t('add')}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 rounded-card" />
      ) : !data?.length ? (
        <EmptyState icon={<Radar className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
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
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-card border border-border bg-surface-2/60 p-4">
        <IconTile icon={Radar} tone={toneFor(track.portal)} />
        <div className="min-w-0">
          <div className="font-semibold">{track.portal}</div>
          <a href={track.url} target="_blank" rel="noreferrer noopener" className="break-all text-[13px] text-link hover:underline">
            {track.url}
          </a>
          {track.listingTitle && <div className="mt-1 text-[13px] text-muted">{track.listingTitle}</div>}
        </div>
      </div>
      {!data ? (
        <Skeleton className="h-32" />
      ) : data.length === 0 ? (
        <p className="text-small text-muted">{t('noHistory')}</p>
      ) : (
        <>
          <div className="card p-4">
            <PriceHistoryChart changes={data} ourPriceMinor={track.listingPriceMinor} label={t('history')} />
          </div>
          <ol className="flex flex-col gap-2">
            {data.map((c) => {
              const down = c.oldPriceMinor !== null && c.newPriceMinor < c.oldPriceMinor;
              const up = c.oldPriceMinor !== null && c.newPriceMinor > c.oldPriceMinor;
              const Icon = down ? ArrowDownRight : up ? ArrowUpRight : Equal;
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink ${down ? 'tone-danger' : up ? 'tone-success' : 'tone-8'}`} aria-hidden>
                    <Icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] text-muted tabular">{formatDateTimeKa(c.createdAt)}</span>
                  <span className="text-right tabular">
                    {c.oldPriceMinor !== null ? <span className="block text-[12px] text-muted line-through">{formatMoney(c.oldPriceMinor)}</span> : null}
                    <span className="font-semibold">{formatMoney(c.newPriceMinor)}</span>
                  </span>
                </li>
              );
            })}
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
            <span className="text-[14px] font-semibold">{t('form.listing')}</span>
            <ListingPicker value={listing} onChange={(id) => setListing(id)} />
          </div>
        )}
      </form>
    </Dialog>
  );
}
