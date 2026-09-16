'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutGrid, List, Plus, Search } from 'lucide-react';
import { formatMoney, type DealCard } from '@lokacia/contracts';
import { Button, cn, EmptyState, Input, Kanban, Skeleton, Table, useToast, type Column, type KanbanColumn } from '@lokacia/ui';
import { MemberSelect } from '@/components/common/pickers';
import { PageHeader } from '@/components/common/page-header';
import { CreateDealDialog } from '@/components/deals/create-deal-dialog';
import { DealCardView } from '@/components/deals/deal-card';
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
  const [pendingLost, setPendingLost] = React.useState<{ id: string; stage: string; index: number } | null>(null);
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

  const columns: KanbanColumn[] = stages.map((s) => {
    const col = items.filter((i) => i.column === s.key);
    const sum = col.reduce((a, d) => a + (d.valueMinor ?? 0), 0);
    return { key: s.key, title: s.name, tone: s.kind, footer: data?.financeVisible && col.length ? t('columnSum', { sum: formatMoney(sum) }) : undefined };
  });

  const applyLocal = (id: string, stage: string, index: number) => {
    if (!data) return;
    const deal = data.deals.find((d) => d.id === id);
    if (!deal) return;
    const others = data.deals.filter((d) => d.id !== id);
    const target = others.filter((d) => d.stage === stage).sort((a, b) => a.position - b.position);
    target.splice(index, 0, { ...deal, stage });
    const repositioned = new Map(target.map((d, i) => [d.id, i]));
    const next = [...others.filter((d) => d.stage !== stage), ...target].map((d) => (repositioned.has(d.id) ? { ...d, stage: d.id === id ? stage : d.stage, position: repositioned.get(d.id)! } : d));
    void mutate({ ...data, deals: next }, { revalidate: false });
  };

  const persist = async (id: string, stage: string, index: number, lostReason?: string) => {
    const prev = data;
    applyLocal(id, stage, index);
    try {
      await mutateApi(`/crm/deals/${id}/move`, { body: { stage, position: index, ...(lostReason ? { lostReason } : {}) } });
      const moved = prev?.deals.find((d) => d.id === id);
      if (moved && moved.stage !== stage) toast({ title: t('moved', { stage: stageName(stage) }), tone: 'success' });
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
    { key: 'title', header: t('fields.title'), cell: (d) => <Link href={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>, sortValue: (d) => d.title },
    { key: 'contact', header: t('fields.contact'), cell: (d) => d.contactName ?? '—', sortValue: (d) => d.contactName ?? '' },
    { key: 'stage', header: t('fields.stage'), cell: (d) => stageName(d.stage), sortValue: (d) => stages.findIndex((s) => s.key === d.stage) },
    ...(data?.financeVisible ? [{ key: 'value', header: t('fields.value'), align: 'right' as const, cell: (d: DealCard) => (d.valueMinor != null ? formatMoney(d.valueMinor) : ''), sortValue: (d: DealCard) => d.valueMinor ?? 0 }] : []),
    { key: 'agent', header: t('agent'), cell: (d) => d.agentName ?? '—', sortValue: (d) => d.agentName ?? '' },
    { key: 'days', header: t('fields.createdAt'), align: 'right', cell: (d) => t('daysInStage', { days: d.daysInStage }), sortValue: (d) => d.daysInStage },
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
          <Button icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => router.push('/deals?new=1')}>
            {t('new')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} prefixIcon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} className="w-full sm:w-64" />
        {can('deals.viewAll') && <MemberSelect value={agentId} onChange={setAgentId} placeholder={t('allAgents')} className="w-full sm:w-56" />}
        <div className="ml-auto flex rounded-button border border-border-strong p-0.5" role="group" aria-label={t('board')}>
          {(['board', 'list'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setViewSaved(v)} className={cn('flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-small', view === v ? 'bg-surface-2 text-text' : 'text-muted')}>
              {v === 'board' ? <LayoutGrid className="size-4" strokeWidth={1.5} aria-hidden /> : <List className="size-4" strokeWidth={1.5} aria-hidden />}
              {t(v)}
            </button>
          ))}
        </div>
      </div>
      {isLoading && !data && <Skeleton className="h-96" />}
      {data && data.deals.length === 0 && !debounced && !agentId ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => router.push('/deals?new=1')}>{t('new')}</Button>} />
      ) : data && view === 'board' ? (
        <Kanban columns={columns} items={items} onMove={onMove} renderItem={(d) => <DealCardView deal={d} />} className="-mx-3 px-3 md:-mx-6 md:px-6" />
      ) : data ? (
        <Table columns={listColumns} rows={data.deals} rowKey={(d) => d.id} onRowClick={(d) => router.push(`/deals/${d.id}`)} empty={t('empty')} />
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
