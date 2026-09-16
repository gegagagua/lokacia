'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatMoney, relativeDaysKa, type ModerationQueueItem } from '@lokacia/contracts';
import { Badge, Button, Checkbox, EmptyState, Select } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';

const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'] as const;

export function ModerationQueueView() {
  const t = useTranslations('moderation');
  const tc = useTranslations('cities');
  const [city, setCity] = React.useState('');
  const list = useCursorList<ModerationQueueItem>(`/admin/moderation/listings${qs({ limit: 50, city })}`);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = React.useState(false);
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

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={list.total !== undefined ? t('subtitle', { count: list.total }) : undefined}
        actions={
          <Select aria-label={t('city')} value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('allCities')} options={CITIES.map((c) => ({ value: c, label: tc(c) }))} className="w-44" />
        }
      />
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-card border border-border-strong bg-surface px-3 py-2 lg:top-2">
          <span className="text-small font-medium">{t('selected', { count: selected.size })}</span>
          <Button size="sm" loading={busy} icon={<Check className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => bulk('approve')}>
            {t('approveSelected')}
          </Button>
          <Button size="sm" variant="danger" icon={<X className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setRejectOpen(true)}>
            {t('rejectSelected')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('clearSelection')}
          </Button>
        </div>
      )}
      {list.error ? (
        <ErrorBlock error={list.error} retry={() => list.mutate()} />
      ) : list.loading ? (
        <LoadingBlock rows={8} />
      ) : list.items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyText')} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-left text-[14px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-small text-muted">
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox aria-label={t('selectAll')} checked={allOn} onCheckedChange={(v) => setSelected(v ? new Set(list.items.map((i) => i.id)) : new Set())} />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">{t('colListing')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('colOwner')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t('colPrice')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t('colDelta')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('colSubmitted')}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                  <td className="px-3 py-2 align-top">
                    <Checkbox aria-label={t('selectOne', { title: i.title })} checked={selected.has(i.id)} onCheckedChange={(v) => toggle(i.id, !!v)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      {i.cover ? <img src={i.cover} alt="" className="h-12 w-16 shrink-0 rounded-photo border border-border object-cover" /> : <div className="h-12 w-16 shrink-0 rounded-photo border border-dashed border-border" />}
                      <div className="min-w-0">
                        <Link href={`/moderation/${i.id}`} className="font-medium text-link hover:underline">
                          {i.title}
                        </Link>
                        <div className="text-small text-muted">
                          {DEAL_TYPE_LABELS_KA[i.dealType as keyof typeof DEAL_TYPE_LABELS_KA] ?? i.dealType} · {i.businessTypes.map((b) => BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b).join(', ')} · {formatArea(i.areaM2)}
                        </div>
                        <div className="truncate text-small text-muted">
                          {i.districtName ? `${i.districtName}, ` : ''}
                          {i.address} · {t('photos', { count: i.photosCount })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link href={`/users/${i.owner.id}`} className="hover:underline">
                      {i.owner.name ?? '—'}
                    </Link>
                    <div className="text-small text-muted">{i.owner.phone}</div>
                    {i.orgName && <div className="text-small text-muted">{i.orgName}</div>}
                  </td>
                  <td className="px-3 py-2 text-right align-top">{formatMoney(i.priceMinor)}</td>
                  <td className="px-3 py-2 text-right align-top">
                    {i.priceDeltaPct === null ? <span className="text-muted">—</span> : <Badge tone={Math.abs(i.priceDeltaPct) > 30 ? 'danger' : 'neutral'}>{i.priceDeltaPct > 0 ? `+${i.priceDeltaPct}%` : `${i.priceDeltaPct}%`}</Badge>}
                  </td>
                  <td className="px-3 py-2 align-top text-small text-muted">{relativeDaysKa(i.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" loading={list.loadingMore} onClick={() => list.loadMore()}>
            {t('loadMore')}
          </Button>
        </div>
      )}
      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectSelectedTitle', { count: selected.size })} confirmLabel={t('rejectSelected')} busy={busy} onConfirm={(r) => bulk('reject', r)} />
    </>
  );
}
