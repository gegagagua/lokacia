'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleDollarSign, LayoutGrid, List, Plus, Search, SquareKanban, Trophy } from 'lucide-react';
import { formatMoney, type DealCard } from '@lokacia/contracts';
import {
  Button,
  EmptyState,
  Input,
  Kanban,
  Skeleton,
  Table,
  useToast,
  type Column,
  type KanbanColumn,
} from '@lokacia/ui';
import { MemberSelect } from '@/components/common/pickers';
import { PageHeader } from '@/components/common/page-header';
import { CreateDealDialog } from '@/components/deals/create-deal-dialog';
import { DealCardView, stageColor } from '@/components/deals/deal-card';
import { IconTile, PersonAvatar, Pill, Segmented } from '@/components/common/ui';
import { LostReasonDialog } from '@/components/deals/lost-reason-dialog';
import type { Board } from '@/components/deals/types';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Item = DealCard & { column: string };

export default function DealsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <DealsBoard />
    </React.Suspense>
  );
}

function DealsBoard() {
  const t = useTranslations('deals');
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { can } = useCrm();
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [view, setView] = React.useState<'board' | 'list'>('board');
  const [pendingLost, setPendingLost] = React.useState<{ id: string; stage: string; index: number } | null>(
    null,
  );
  const createOpen = params.get('new') === '1';

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  React.useEffect(() => {
    try {
      if (window.matchMedia('(max-width: 767px)').matches) setView('list');
      const saved = localStorage.getItem('lk-crm-deals-view');
      if (saved === 'board' || saved === 'list') setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const qs = new URLSearchParams();
  if (agentId) qs.set('agentId', agentId);
  if (debounced) qs.set('q', debounced);
  const { data, mutate, isLoading } = useApi<Board>(`/crm/deals${qs.toString() ? `?${qs}` : ''}`);
  const stages = React.useMemo(() => data?.pipeline.stages ?? [], [data]);
  const stageName = (k: string) => stages.find((s) => s.key === k)?.name ?? k;

  const items: Item[] = React.useMemo(
    () => (data?.deals ?? []).map((d) => ({ ...d, column: d.stage })).sort((a, b) => a.position - b.position),
    [data],
  );

  const openIndex = (key: string) => stages.filter((s) => s.kind === 'open').findIndex((s) => s.key === key);
  const colorOf = (key: string) => {
    const st = stages.find((s) => s.key === key);
    return st ? stageColor(st.kind, Math.max(0, openIndex(key))) : 'var(--tone-8)';
  };

  const columns: KanbanColumn[] = stages.map((s) => {
    const col = items.filter((i) => i.column === s.key);
    const sum = col.reduce((a, d) => a + (d.valueMinor ?? 0), 0);
    return {
      key: s.key,
      title: s.name,
      tone: s.kind,
      color: colorOf(s.key),
      subtitle: data?.financeVisible && col.length ? formatMoney(sum) : undefined,
    };
  });

  const summary = React.useMemo(() => {
    const deals = data?.deals ?? [];
    const kindOf = (k: string) => stages.find((s) => s.key === k)?.kind;
    const open = deals.filter((d) => kindOf(d.stage) === 'open');
    const won = deals.filter((d) => kindOf(d.stage) === 'won');
    return {
      open: open.length,
      openValue: open.reduce((a, d) => a + (d.valueMinor ?? 0), 0),
      won: won.length,
      wonValue: won.reduce((a, d) => a + (d.valueMinor ?? 0), 0),
    };
  }, [data, stages]);

  const applyLocal = (id: string, stage: string, index: number) => {
    if (!data) return;
    const deal = data.deals.find((d) => d.id === id);
    if (!deal) return;
    const others = data.deals.filter((d) => d.id !== id);
    const target = others.filter((d) => d.stage === stage).sort((a, b) => a.position - b.position);
    target.splice(index, 0, { ...deal, stage });
    const repositioned = new Map(target.map((d, i) => [d.id, i]));
    const next = [...others.filter((d) => d.stage !== stage), ...target].map((d) =>
      repositioned.has(d.id)
        ? { ...d, stage: d.id === id ? stage : d.stage, position: repositioned.get(d.id)! }
        : d,
    );
    void mutate({ ...data, deals: next }, { revalidate: false });
  };

  const persist = async (id: string, stage: string, index: number, lostReason?: string) => {
    const prev = data;
    applyLocal(id, stage, index);
    try {
      await mutateApi(`/crm/deals/${id}/move`, {
        body: { stage, position: index, ...(lostReason ? { lostReason } : {}) },
      });
      const moved = prev?.deals.find((d) => d.id === id);
      if (moved && moved.stage !== stage)
        toast({ title: t('moved', { stage: stageName(stage) }), tone: 'success' });
      await mutate();
    } catch (e) {
      if (prev) void mutate(prev, { revalidate: false });
      toast({ title: t('moveFailed'), description: errorMessage(e), tone: 'danger' });
    }
  };

  const onMove = (id: string, stage: string, index: number) => {
    const deal = data?.deals.find((d) => d.id === id);
    if (!deal) return;
    const kind = stages.find((s) => s.key === stage)?.kind;
    if (kind === 'lost' && deal.stage !== stage) {
      setPendingLost({ id, stage, index });
      return;
    }
    void persist(id, stage, index);
  };

  const listColumns: Column<DealCard>[] = [
    {
      key: 'title',
      header: t('fields.title'),
      cell: (d) => (
        <Link
          href={`/deals/${d.id}`}
          className="flex min-w-0 items-center gap-2.5 font-semibold hover:text-primary-soft-text"
        >
          <PersonAvatar name={d.contactName ?? d.title} size={30} />
          <span className="min-w-0">
            <span className="block truncate">{d.title}</span>
            {d.listingTitle && (
              <span className="block truncate text-[12.5px] font-normal text-muted">{d.listingTitle}</span>
            )}
          </span>
        </Link>
      ),
      sortValue: (d) => d.title,
    },
    {
      key: 'contact',
      header: t('fields.contact'),
      cell: (d) => d.contactName ?? '—',
      sortValue: (d) => d.contactName ?? '',
    },
    {
      key: 'stage',
      header: t('fields.stage'),
      cell: (d) => (
        <span
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${colorOf(d.stage)} 14%, transparent)`,
            color: `color-mix(in srgb, ${colorOf(d.stage)} 72%, var(--text))`,
          }}
        >
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: colorOf(d.stage) }} />
          {stageName(d.stage)}
        </span>
      ),
      sortValue: (d) => stages.findIndex((s) => s.key === d.stage),
    },
    ...(data?.financeVisible
      ? [
          {
            key: 'value',
            header: t('fields.value'),
            align: 'right' as const,
            cell: (d: DealCard) => (
              <span className="font-semibold tabular">
                {d.valueMinor != null ? formatMoney(d.valueMinor) : ''}
              </span>
            ),
            sortValue: (d: DealCard) => d.valueMinor ?? 0,
          },
        ]
      : []),
    {
      key: 'agent',
      header: t('agent'),
      cell: (d) => (
        <span className="flex items-center gap-2">
          <PersonAvatar name={d.agentName} size={24} />
          <span className="truncate">{d.agentName ?? '—'}</span>
        </span>
      ),
      sortValue: (d) => d.agentName ?? '',
    },
    {
      key: 'days',
      header: t('fields.createdAt'),
      align: 'right',
      cell: (d) => <span className="text-muted tabular">{t('daysInStage', { days: d.daysInStage })}</span>,
      sortValue: (d) => d.daysInStage,
    },
  ];

  const setViewSaved = (v: 'board' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('lk-crm-deals-view', v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            icon={<Plus className="size-4" strokeWidth={2.2} aria-hidden />}
            onClick={() => router.push('/deals?new=1')}
          >
            {t('new')}
          </Button>
        }
      />
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile icon={SquareKanban} tone={2} label={t('summary.open')} value={String(summary.open)} />
          {data.financeVisible && (
            <SummaryTile
              icon={CircleDollarSign}
              tone="primary"
              label={t('summary.pipeline')}
              value={formatMoney(summary.openValue)}
            />
          )}
          <SummaryTile icon={Trophy} tone="success" label={t('summary.won')} value={String(summary.won)} />
          {data.financeVisible && (
            <SummaryTile
              icon={Trophy}
              tone={3}
              label={t('summary.wonValue')}
              value={formatMoney(summary.wonValue)}
            />
          )}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-2 shadow-xs">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />}
          className="h-10 w-full border-transparent bg-surface-2 sm:w-72"
        />
        {can('deals.viewAll') && (
          <MemberSelect
            value={agentId}
            onChange={setAgentId}
            placeholder={t('allAgents')}
            className="h-10 w-full sm:w-56"
          />
        )}
        {(debounced || agentId) && data && (
          <Pill tone="primary">{t('found', { count: data.deals.length })}</Pill>
        )}
        <Segmented
          className="ml-auto"
          label={t('viewLabel')}
          value={view}
          onChange={setViewSaved}
          options={[
            { value: 'board', label: t('board'), icon: LayoutGrid },
            { value: 'list', label: t('list'), icon: List },
          ]}
        />
      </div>
      {isLoading && !data && (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[420px] w-[300px] shrink-0 rounded-card" />
          ))}
        </div>
      )}
      {data && data.deals.length === 0 && !debounced && !agentId ? (
        <EmptyState
          icon={<SquareKanban className="size-6" strokeWidth={2} aria-hidden />}
          title={t('empty')}
          description={t('emptyHint')}
          action={<Button onClick={() => router.push('/deals?new=1')}>{t('new')}</Button>}
        />
      ) : data && view === 'board' ? (
        <div className="-mx-4 md:-mx-8 md:h-[calc(100dvh-360px)] md:min-h-[480px]">
          <Kanban
            columns={columns}
            items={items}
            onMove={onMove}
            renderItem={(d) => <DealCardView deal={d} showValue={data.financeVisible} />}
            className="h-full px-4 md:px-8"
          />
        </div>
      ) : data ? (
        <>
          <ul className="flex flex-col gap-2.5 md:hidden">
            {data.deals.map((d) => (
              <li key={d.id}>
                <DealCardView
                  deal={d}
                  showValue={data.financeVisible}
                  stage={{ name: stageName(d.stage), color: colorOf(d.stage) }}
                />
              </li>
            ))}
            {data.deals.length === 0 && <li className="card p-6 text-center text-muted">{t('empty')}</li>}
          </ul>
          <div className="card hidden overflow-hidden md:block">
            <Table
              className="border-0"
              columns={listColumns}
              rows={data.deals}
              rowKey={(d) => d.id}
              onRowClick={(d) => router.push(`/deals/${d.id}`)}
              empty={t('empty')}
            />
          </div>
        </>
      ) : null}
      <LostReasonDialog
        open={!!pendingLost}
        onCancel={() => setPendingLost(null)}
        onConfirm={async (reason) => {
          const p = pendingLost!;
          setPendingLost(null);
          await persist(p.id, p.stage, p.index, reason);
        }}
      />
      <CreateDealDialog
        open={createOpen}
        onOpenChange={(o) => !o && router.replace('/deals')}
        initial={{ contactId: params.get('contactId'), listingId: params.get('listingId') }}
        onCreated={(id) => {
          void mutate();
          router.push(`/deals/${id}`);
        }}
      />
    </div>
  );
}

function SummaryTile({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof IconTile>['icon'];
  tone: React.ComponentProps<typeof IconTile>['tone'];
  label: string;
  value: string;
}) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-3 sm:p-3.5">
      <IconTile icon={icon} tone={tone} className="hidden sm:grid" />
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-muted">{label}</div>
        <div className="truncate text-[17px] font-bold leading-7 tracking-tight tabular sm:text-[19px]">
          {value}
        </div>
      </div>
    </div>
  );
}
