'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, ClipboardCheck, Clock, ImageIcon, MapPin, Ruler, X } from 'lucide-react';
import { BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatMoney, relativeDaysKa, type ModerationQueueItem } from '@lokacia/contracts';
import { Button, Checkbox, EmptyState, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';
import { DeltaMeter, Person, PillFilter, Toolbar } from '@/components/kit';

const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'] as const;

function ReviewCard({
  item: i,
  selected,
  onSelect,
  onApprove,
  onReject,
  busy,
}: {
  item: ModerationQueueItem;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const t = useTranslations('moderation');
  const priceM2 = i.areaM2 > 0 ? Math.round(i.priceMinor / i.areaM2) : null;
  return (
    <article className={cn('card group flex min-w-0 flex-col overflow-hidden transition-all duration-200 hover:shadow-md md:flex-row', selected && 'ring-2 ring-primary')}>
      {/* photo */}
      <div className="relative shrink-0 md:w-60 xl:w-72">
        <Link href={`/moderation/${i.id}`} tabIndex={-1} aria-hidden className="block h-full overflow-hidden bg-surface-2">
          {i.cover ? (
            <img src={i.cover} alt="" className="aspect-[16/9] size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] md:aspect-auto md:min-h-52" />
          ) : (
            <div className="drawing-grid grid aspect-[16/9] size-full place-items-center text-muted md:aspect-auto md:min-h-52">
              <ImageIcon className="size-8" strokeWidth={1.75} />
            </div>
          )}
        </Link>
        <div className="absolute left-3 top-3 grid size-9 place-items-center rounded-xl bg-surface/90 shadow-sm backdrop-blur">
          <Checkbox aria-label={t('selectOne', { title: i.title })} checked={selected} onCheckedChange={(v) => onSelect(!!v)} />
        </div>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12.5px] font-semibold text-white backdrop-blur">
          <ImageIcon className="size-3.5" strokeWidth={2} aria-hidden />
          {t('photos', { count: i.photosCount })}
        </span>
      </div>

      {/* body */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold text-primary-soft-text">{DEAL_TYPE_LABELS_KA[i.dealType as keyof typeof DEAL_TYPE_LABELS_KA] ?? i.dealType}</span>
          {i.businessTypes.slice(0, 3).map((b) => (
            <span key={b} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-text">
              {BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b}
            </span>
          ))}
          {i.businessTypes.length > 3 && <span className="text-[12.5px] text-muted">+{i.businessTypes.length - 3}</span>}
        </div>
        <h2 className="text-[17px] font-bold leading-snug tracking-tight">
          <Link href={`/moderation/${i.id}`} className="hover:text-link hover:underline focus-visible:shadow-ring focus-visible:outline-none">
            {i.title}
          </Link>
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] text-muted">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">
              {i.districtName ? `${i.districtName}, ` : ''}
              {i.address}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular">
            <Ruler className="size-4" strokeWidth={2} aria-hidden />
            {formatArea(i.areaM2)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" strokeWidth={2} aria-hidden />
            {relativeDaysKa(i.submittedAt)}
          </span>
        </div>
        <div className="mt-auto border-t border-border pt-3">
          <Person name={i.owner.name} href={`/users/${i.owner.id}`} size={32} sub={[i.owner.phone, i.orgName].filter(Boolean).join(' · ')} />
        </div>
      </div>

      {/* decision column */}
      <div className="flex shrink-0 flex-col gap-4 border-t border-border bg-surface-2/40 p-4 md:w-64 md:border-l md:border-t-0 md:p-5 xl:w-72">
        <div>
          <div className="text-[13px] font-medium text-muted">{t('colPrice')}</div>
          <div className="text-[24px] font-bold leading-tight tracking-tight tabular">{formatMoney(i.priceMinor)}</div>
          {priceM2 !== null && <div className="text-[13px] text-muted tabular">{t('perM2', { price: formatMoney(priceM2) })}</div>}
        </div>
        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">{t('colDelta')}</div>
          {i.priceDeltaPct === null ? <div className="text-small text-muted">{t('noDelta')}</div> : <DeltaMeter pct={i.priceDeltaPct} label={t('colDelta')} />}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button size="sm" variant="danger" onClick={onReject} icon={<X className="size-4" strokeWidth={2} aria-hidden />} aria-label={`${t('reject')}: ${i.title}`}>
            {t('reject')}
          </Button>
          <Button size="sm" loading={busy} onClick={onApprove} icon={<Check className="size-4" strokeWidth={2} aria-hidden />} aria-label={`${t('approve')}: ${i.title}`}>
            {t('approve')}
          </Button>
          <Button asChild size="sm" variant="secondary" className="col-span-2">
            <Link href={`/moderation/${i.id}`}>
              {t('review')}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ModerationQueueView() {
  const t = useTranslations('moderation');
  const tc = useTranslations('cities');
  const [city, setCity] = React.useState('');
  const list = useCursorList<ModerationQueueItem>(`/admin/moderation/listings${qs({ limit: 50, city })}`);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [single, setSingle] = React.useState<ModerationQueueItem | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [live, setLive] = React.useState('');
  const { run, busy } = useAction();

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOn = list.items.length > 0 && list.items.every((i) => selected.has(i.id));

  const bulk = async (action: 'approve' | 'reject', reason?: string) => {
    const ids = [...selected];
    const res = await run(() => apiFetch<{ ok: number; failed: { id: string; error: string }[] }>('/admin/moderation/listings/bulk', { method: 'POST', body: { ids, action, reason } }));
    if (res) {
      const msg = t('bulkDone', { ok: res.ok, failed: res.failed.length });
      setLive(msg);
      setSelected(new Set());
      setRejectOpen(false);
      await list.mutate();
    }
  };

  const approveOne = async (i: ModerationQueueItem) => {
    setPendingId(i.id);
    const r = await run(() => apiFetch(`/admin/moderation/listings/${i.id}/approve`, { method: 'POST' }), t('approved'));
    setPendingId(null);
    if (r !== undefined) {
      setLive(t('approved'));
      toggle(i.id, false);
      await list.mutate();
    }
  };
  const rejectOne = async (reason: string) => {
    if (!single) return;
    const r = await run(() => apiFetch(`/admin/moderation/listings/${single.id}/reject`, { method: 'POST', body: { reason } }), t('rejected'));
    if (r !== undefined) {
      setLive(t('rejected'));
      toggle(single.id, false);
      setSingle(null);
      await list.mutate();
    }
  };

  return (
    <>
      <PageHeader icon={ClipboardCheck} title={t('title')} subtitle={list.total !== undefined ? t('subtitle', { count: list.total }) : t('lead')} />
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
      <Toolbar className="justify-between">
        <PillFilter
          label={t('city')}
          value={city}
          onChange={setCity}
          options={[{ value: '', label: t('allCities') }, ...CITIES.map((c) => ({ value: c, label: tc(c) }))]}
          className="min-w-0 basis-full sm:basis-auto sm:flex-1"
        />
        {list.items.length > 0 && (
          <div className="flex items-center gap-2 px-1 sm:pr-1">
            <Checkbox label={t('selectAll')} checked={allOn} onCheckedChange={(v) => setSelected(v ? new Set(list.items.map((i) => i.id)) : new Set())} />
          </div>
        )}
      </Toolbar>

      {list.error ? (
        <ErrorBlock error={list.error} retry={() => list.mutate()} />
      ) : list.loading ? (
        <LoadingBlock rows={8} />
      ) : list.items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyText')} icon={<Check className="size-6" strokeWidth={2} aria-hidden />} />
      ) : (
        <div className="flex flex-col gap-4">
          {list.items.map((i) => (
            <ReviewCard key={i.id} item={i} selected={selected.has(i.id)} onSelect={(on) => toggle(i.id, on)} onApprove={() => approveOne(i)} onReject={() => setSingle(i)} busy={busy && pendingId === i.id} />
          ))}
        </div>
      )}
      {list.hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" loading={list.loadingMore} onClick={() => list.loadMore()}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      {/* floating bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/95 p-2.5 pl-4 shadow-lg backdrop-blur lg:left-[272px] lg:right-0" role="region" aria-label={t('selected', { count: selected.size })}>
          <span className="mr-auto inline-flex items-center gap-2 text-[15px] font-semibold">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-[13px] font-bold tabular text-primary-contrast">{selected.size}</span>
            <span className="hidden sm:inline">{t('selectedShort')}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('clearSelection')}
          </Button>
          <Button size="sm" variant="danger" icon={<X className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setRejectOpen(true)}>
            {t('rejectSelected')}
          </Button>
          <Button size="sm" loading={busy} icon={<Check className="size-4" strokeWidth={2} aria-hidden />} onClick={() => bulk('approve')}>
            {t('approveSelected')}
          </Button>
        </div>
      )}
      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectSelectedTitle', { count: selected.size })} confirmLabel={t('rejectSelected')} busy={busy} onConfirm={(r) => bulk('reject', r)} />
      <ReasonDialog open={!!single} onOpenChange={(o) => !o && setSingle(null)} title={t('rejectTitle')} description={single?.title} confirmLabel={t('reject')} busy={busy} onConfirm={rejectOne} />
    </>
  );
}
