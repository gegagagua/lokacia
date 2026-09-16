'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlarmClock, CheckCheck, CircleCheck, EyeOff, MessageSquareText, Phone, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import { formatDateKa, formatDateTimeKa, LIVENESS_STATES, type CrmLivenessRow, type LivenessState } from '@lokacia/contracts';
import { Button, Checkbox, cn, EmptyState, Skeleton, Table, useToast, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { IconTile, Pill, Progress, toneClass, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

const META: Record<LivenessState, { tone: Tone; icon: LucideIcon }> = {
  ok: { tone: 'success', icon: CircleCheck },
  due: { tone: 3, icon: AlarmClock },
  overdue: { tone: 'danger', icon: TriangleAlert },
  stale: { tone: 8, icon: EyeOff },
};
/** Visual scale for the age bar (days since the owner last confirmed). */
const AGE_SCALE = 45;

export function LivenessView() {
  const t = useTranslations('marketing.liveness');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<CrmLivenessRow[]>('/crm/liveness');
  const [filter, setFilter] = React.useState<LivenessState | ''>('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);

  const counts = React.useMemo(() => Object.fromEntries(LIVENESS_STATES.map((s) => [s, (data ?? []).filter((r) => r.state === s).length])) as Record<LivenessState, number>, [data]);
  const total = data?.length ?? 0;
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
      cell: (r) => (
        <Checkbox
          checked={selected.has(r.id)}
          onCheckedChange={(c) =>
            setSelected((s) => {
              const n = new Set(s);
              if (c) n.add(r.id);
              else n.delete(r.id);
              return n;
            })
          }
          aria-label={`${t('select')}: ${r.title}`}
        />
      ),
    },
    {
      key: 'listing',
      header: t('columns.listing'),
      sortValue: (r) => r.title,
      cell: (r) => (
        <div className="flex min-w-[240px] items-center gap-3">
          <IconTile icon={META[r.state].icon} tone={META[r.state].tone} size="sm" />
          <div className="min-w-0">
            <Link href={`/listings/${r.id}`} className="line-clamp-1 font-semibold hover:text-primary-soft-text">
              {r.title}
            </Link>
            <div className="line-clamp-1 text-[13px] text-muted">{r.address}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: t('columns.state'),
      sortValue: (r) => LIVENESS_STATES.indexOf(r.state),
      cell: (r) => (
        <Pill tone={META[r.state].tone} dot>
          {t(`states.${r.state}`)}
        </Pill>
      ),
    },
    { key: 'lastConfirmed', header: t('columns.lastConfirmed'), sortValue: (r) => r.lastConfirmedAt, cell: (r) => <span className="whitespace-nowrap text-[13.5px]">{r.lastConfirmedAt ? formatDateKa(r.lastConfirmedAt) : <span className="text-muted">{t('never')}</span>}</span> },
    {
      key: 'days',
      header: t('columns.days'),
      sortValue: (r) => r.daysSince,
      cell: (r) => (
        <div className="flex min-w-28 items-center gap-2">
          <Progress value={r.daysSince == null ? 100 : (r.daysSince / AGE_SCALE) * 100} tone={META[r.state].tone === 8 ? 8 : META[r.state].tone} label={t('columns.days')} className="h-2" />
          <span className={cn('w-8 shrink-0 text-right font-semibold tabular', r.state === 'overdue' ? 'text-danger' : 'text-text')}>{r.daysSince ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'lastCheck',
      header: t('columns.lastCheck'),
      sortValue: (r) => r.lastCheck?.sentAt ?? null,
      cell: (r) =>
        r.lastCheck ? (
          <div className="whitespace-nowrap text-[13.5px]">
            <div className="font-medium">{t.has(`results.${r.lastCheck.result}`) ? t(`results.${r.lastCheck.result}`) : r.lastCheck.result}</div>
            <div className="text-[12.5px] text-muted tabular">{formatDateTimeKa(r.lastCheck.sentAt)}</div>
          </div>
        ) : (
          <span className="text-[13.5px] text-muted">{t('noCheck')}</span>
        ),
    },
    {
      key: 'owner',
      header: t('columns.owner'),
      cell: (r) =>
        r.ownerPhone ? (
          <a href={`tel:${r.ownerPhone}`} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] tabular hover:text-primary-soft-text">
            <Phone className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
            {r.ownerPhone}
          </a>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => ask([r.id])} disabled={busy !== null || r.lastCheck?.result === 'pending'} aria-label={t('ask')} title={t('ask')} icon={<MessageSquareText className="size-4" strokeWidth={2} aria-hidden />} />
          <Button size="sm" variant="secondary" onClick={() => confirm(r.id)} loading={busy === r.id} icon={<CheckCheck className="size-4" strokeWidth={2} aria-hidden />}>
            {t('confirm')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size="sm" disabled={!selected.size} loading={busy === 'ask'} onClick={() => ask([...selected])} icon={<MessageSquareText className="size-4" strokeWidth={2} aria-hidden />}>
            {t('askSelected', { count: selected.size })}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" role="group" aria-label={t('filter')}>
        {LIVENESS_STATES.map((s) => {
          const m = META[s];
          const on = filter === s;
          const share = total ? (counts[s] / total) * 100 : 0;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter((f) => (f === s ? '' : s))}
              className={cn(
                'card card-hover flex flex-col items-stretch gap-3 p-4 text-left focus-visible:shadow-ring focus-visible:outline-none md:p-5',
                on && cn('border-tone ring-2 ring-tone', toneClass(m.tone)),
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[13.5px] font-medium leading-5 text-muted">{t(`states.${s}`)}</span>
                <IconTile icon={m.icon} tone={m.tone} size="sm" />
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold leading-9 tracking-tight tabular">{data ? counts[s] : '—'}</span>
                {data && total > 0 && <span className="text-[13px] font-semibold text-muted tabular">{Math.round(share)}%</span>}
              </span>
              <Progress value={share} tone={m.tone} label={t(`states.${s}`)} />
            </button>
          );
        })}
      </div>
      {isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !rows.length ? (
        <EmptyState icon={<ShieldCheck className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(r) => r.id} initialSort={{ key: 'days', dir: 'desc' }} />
      )}
    </div>
  );
}
