'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCheck, MessageSquareText, ShieldCheck } from 'lucide-react';
import { formatDateKa, formatDateTimeKa, LIVENESS_STATES, type CrmLivenessRow, type LivenessState } from '@lokacia/contracts';
import { Badge, Button, Checkbox, cn, EmptyState, Skeleton, Table, useToast, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

const TONE = { ok: 'success', due: 'accent', overdue: 'danger', stale: 'neutral' } as const;

export function LivenessView() {
  const t = useTranslations('marketing.liveness');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<CrmLivenessRow[]>('/crm/liveness');
  const [filter, setFilter] = React.useState<LivenessState | ''>('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);

  const counts = React.useMemo(() => Object.fromEntries(LIVENESS_STATES.map((s) => [s, (data ?? []).filter((r) => r.state === s).length])) as Record<LivenessState, number>, [data]);
  const rows = (data ?? []).filter((r) => !filter || r.state === filter);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const ask = async (ids: string[]) => {
    setBusy('ask');
    try {
      const r = await mutateApi<{ sent: number; skipped: number }>('/crm/liveness/ask', { body: { listingIds: ids } });
      toast({ title: t('asked', r), tone: 'success' });
      setSelected(new Set());
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const confirm = async (id: string) => {
    setBusy(id);
    try {
      await mutateApi(`/crm/liveness/${id}/confirm`);
      toast({ title: t('confirmed'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<CrmLivenessRow>[] = [
    {
      key: 'select',
      header: <Checkbox checked={allSelected} onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())} aria-label={t('selectAll')} />,
      cell: (r) => <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(r.id); else n.delete(r.id); return n; })} aria-label={`${t('select')}: ${r.title}`} />,
    },
    {
      key: 'listing',
      header: t('columns.listing'),
      sortValue: (r) => r.title,
      cell: (r) => (
        <div className="min-w-[200px]">
          <Link href={`/listings/${r.id}`} className="line-clamp-1 font-medium hover:underline">
            {r.title}
          </Link>
          <div className="line-clamp-1 text-small text-muted">{r.address}</div>
        </div>
      ),
    },
    { key: 'state', header: t('columns.state'), sortValue: (r) => LIVENESS_STATES.indexOf(r.state), cell: (r) => <Badge tone={TONE[r.state]}>{t(`states.${r.state}`)}</Badge> },
    { key: 'lastConfirmed', header: t('columns.lastConfirmed'), sortValue: (r) => r.lastConfirmedAt, cell: (r) => <span className="whitespace-nowrap text-small">{r.lastConfirmedAt ? formatDateKa(r.lastConfirmedAt) : t('never')}</span> },
    { key: 'days', header: t('columns.days'), align: 'right', sortValue: (r) => r.daysSince, cell: (r) => <span className={cn(r.state === 'overdue' && 'font-semibold text-danger')}>{r.daysSince ?? '—'}</span> },
    {
      key: 'lastCheck',
      header: t('columns.lastCheck'),
      sortValue: (r) => r.lastCheck?.sentAt ?? null,
      cell: (r) =>
        r.lastCheck ? (
          <div className="whitespace-nowrap text-small">
            <div>{t.has(`results.${r.lastCheck.result}`) ? t(`results.${r.lastCheck.result}`) : r.lastCheck.result}</div>
            <div className="text-muted tabular">{formatDateTimeKa(r.lastCheck.sentAt)}</div>
          </div>
        ) : (
          <span className="text-muted">{t('noCheck')}</span>
        ),
    },
    { key: 'owner', header: t('columns.owner'), cell: (r) => <span className="whitespace-nowrap text-small tabular">{r.ownerPhone ?? '—'}</span> },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => ask([r.id])} disabled={busy !== null || r.lastCheck?.result === 'pending'} aria-label={t('ask')} title={t('ask')} icon={<MessageSquareText className="size-3.5" strokeWidth={1.5} aria-hidden />} />
          <Button size="sm" variant="secondary" onClick={() => confirm(r.id)} loading={busy === r.id} icon={<CheckCheck className="size-3.5" strokeWidth={1.5} aria-hidden />}>
            {t('confirm')}
          </Button>
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
          <Button size="sm" disabled={!selected.size} loading={busy === 'ask'} onClick={() => ask([...selected])} icon={<MessageSquareText className="size-3.5" strokeWidth={1.5} aria-hidden />}>
            {t('askSelected', { count: selected.size })}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label={t('filter')}>
        {LIVENESS_STATES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter((f) => (f === s ? '' : s))}
            className={cn('flex flex-col items-start rounded-card border bg-surface p-3 text-left transition-colors', filter === s ? 'border-primary' : 'border-border hover:border-border-strong')}
          >
            <span className="flex items-center gap-1.5 text-small text-muted">
              <span className={cn('size-2 rounded-full', s === 'ok' && 'bg-success', s === 'due' && 'bg-accent', s === 'overdue' && 'bg-danger', s === 'stale' && 'bg-border-strong')} aria-hidden />
              {t(`states.${s}`)}
            </span>
            <span className="compact text-h2 font-semibold tabular">{data ? counts[s] : '—'}</span>
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !rows.length ? (
        <EmptyState icon={<ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(r) => r.id} initialSort={{ key: 'days', dir: 'desc' }} />
      )}
    </div>
  );
}
