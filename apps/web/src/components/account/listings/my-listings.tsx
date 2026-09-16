'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { BarChart3, CalendarClock, CheckCircle2, ExternalLink, Eye, Heart, MoreHorizontal, Pencil, Phone, Plus } from 'lucide-react';
import type { ListingCard, ListingStatus } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Dialog, Drawer, EmptyState, Popover, Skeleton, VipBadge, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { VipPurchaseButton } from '@/components/billing/vip-button';
import { AccountPageHeader } from '../page-header';
import { ListingStatusBadge } from '../status-badges';
import { SlotsManager } from './slots-manager';

export type MyListing = ListingCard & { rejectReason: string | null; vipUntil: string | null; stats30d: { views: number; reveals: number; saves: number } };

const FILTERS: { key: string; statuses: ListingStatus[] | null }[] = [
  { key: 'all', statuses: null },
  { key: 'active', statuses: ['active'] },
  { key: 'attention', statuses: ['stale', 'rejected'] },
  { key: 'drafts', statuses: ['draft'] },
  { key: 'review', statuses: ['pending_review'] },
  { key: 'closed', statuses: ['rented', 'sold', 'archived'] },
];

export function MyListings() {
  const t = useTranslations('myListings');
  const { data, isLoading, mutate } = useSWR<MyListing[]>('/listings/mine', fetcher);
  const [filter, setFilter] = React.useState('all');
  const items = data ?? [];
  const current = FILTERS.find((f) => f.key === filter)!;
  const shown = current.statuses ? items.filter((i) => current.statuses!.includes(i.status)) : items;

  return (
    <div>
      <AccountPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button asChild>
            <Link href="/account/listings/new">
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('publish')}
            </Link>
          </Button>
        }
      />
      <div role="tablist" aria-label={t('filters.label')} className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => {
          const count = f.statuses ? items.filter((i) => f.statuses!.includes(i.status)).length : items.length;
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-button border px-3 text-small', active ? 'border-primary bg-primary text-primary-contrast' : 'border-border text-muted hover:bg-surface-2 hover:text-text')}
            >
              {t(`filters.${f.key}`)}
              <span className={cn('tabular', active ? 'opacity-80' : '')}>{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button asChild>
              <Link href="/account/listings/new">{t('publish')}</Link>
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState title={t('empty.filtered')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((l) => (
            <li key={l.id}>
              <ListingRow listing={l} onChanged={() => mutate()} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({ listing: l, onChanged }: { listing: MyListing; onChanged: () => Promise<unknown> }) {
  const t = useTranslations('myListings');
  const f = useFormat();
  const lp = useLocalizedPath();
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [slots, setSlots] = React.useState<null | 'viewing' | 'short_term'>(null);
  const [menu, setMenu] = React.useState(false);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setMenu(false);
    try {
      await fn();
      toast({ title: success, tone: 'success' });
      await onChanged();
    } catch (e) {
      if (e instanceof ClientApiError && e.problem?.type?.endsWith('passport-incomplete')) {
        toast({ title: t('toast.passport'), description: e.problem.errors?.map((x) => x.path.replace('passport.', '')).join(', '), tone: 'danger' });
        window.setTimeout(() => (window.location.href = lp(`/account/listings/${l.id}/edit?step=passport`)), 1500);
      } else toast({ title: e instanceof ClientApiError ? e.message : t('toast.error'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const setStatus = (status: ListingStatus, success = t('toast.status')) => run(status, () => apiFetch(`/listings/${l.id}/status`, { method: 'POST', body: { status } }), success);
  const confirmOwner = () => run('confirm', () => apiFetch(`/listings/${l.id}/confirm-owner`, { method: 'POST' }), t('toast.confirmed'));

  const s = l.status;
  const isPublic = ['active', 'stale', 'rented', 'sold'].includes(s);
  const closeStatus: ListingStatus = l.dealType === 'sale' ? 'sold' : 'rented';

  // primary actions shown as buttons; the rest in the "more" popover
  const primary: React.ReactNode[] = [];
  const secondary: { key: string; label: string; onClick: () => void; danger?: boolean }[] = [];
  if (s === 'active' || s === 'stale') {
    primary.push(
      <Button key="confirm" size="sm" variant={s === 'stale' ? 'primary' : 'secondary'} loading={busy === 'confirm'} onClick={confirmOwner} icon={<CheckCircle2 className="size-4" strokeWidth={1.5} aria-hidden />}>
        {t('actions.confirm')}
      </Button>,
    );
    secondary.push({ key: closeStatus, label: t(`actions.${closeStatus}`), onClick: () => void setStatus(closeStatus) });
    secondary.push({ key: 'slots', label: t('actions.slots'), onClick: () => setSlots('viewing') });
    if (l.dealType === 'short_term') secondary.push({ key: 'shortSlots', label: t('actions.shortSlots'), onClick: () => setSlots('short_term') });
    secondary.push({ key: 'archive', label: t('actions.archive'), onClick: () => void setStatus('archived') });
  }
  if (s === 'draft' || s === 'rejected' || s === 'rented') {
    primary.push(
      <Button key="submit" size="sm" loading={busy === 'pending_review'} onClick={() => void setStatus('pending_review', t('toast.submitted'))}>
        {t('actions.submit')}
      </Button>,
    );
  }
  if (s === 'draft' || s === 'rented' || s === 'sold') secondary.push({ key: 'archive', label: t('actions.archive'), onClick: () => void setStatus('archived') });
  if (s === 'archived') secondary.push({ key: 'restore', label: t('actions.restore'), onClick: () => void setStatus('draft') });
  secondary.push({ key: 'delete', label: t('actions.delete'), onClick: () => setConfirmDelete(true), danger: true });

  return (
    <article className={cn('flex flex-col gap-4 rounded-card border bg-surface p-3 sm:flex-row sm:p-4', s === 'stale' || s === 'rejected' ? 'border-accent' : 'border-border')}>
      <Link href={`/account/listings/${l.id}/edit`} className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-photo border border-border bg-surface-2 sm:w-44" tabIndex={-1} aria-hidden>
        {l.cover ? <img src={l.cover} alt="" className="size-full object-cover" loading="lazy" /> : <span className="drawing-grid grid size-full place-items-center text-small text-muted">{t('card.noPhoto')}</span>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ListingStatusBadge status={s} />
          {l.vip && <VipBadge />}
          <span className="text-small text-muted">{l.lastConfirmedAt ? t('card.confirmed', { when: f.relativeDays(l.lastConfirmedAt) }) : t('card.notConfirmed')}</span>
        </div>
        <h2 className="text-[17px] font-medium leading-snug">
          <Link href={isPublic ? `/listings/${l.slug}` : `/account/listings/${l.id}/edit`} className="hover:underline">
            {l.title}
          </Link>
        </h2>
        <p className="truncate text-small text-muted">
          {[l.districtName, l.address].filter(Boolean).join(' · ')} · {f.area(l.areaM2)}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="compact text-h3 font-semibold tabular">
            {f.money(l.priceMinor, l.currency)}
            {l.pricePeriod === 'month' && <span className="text-small font-normal text-muted"> {t('card.perMonth')}</span>}
          </span>
          <span className="flex items-center gap-3 text-small text-muted tabular" aria-label={t('card.stats30d')}>
            <span className="text-[11px] uppercase tracking-wide">{t('card.stats30d')}</span>
            <span className="inline-flex items-center gap-1" title={t('card.views')}>
              <Eye className="size-3.5" strokeWidth={1.5} aria-hidden />
              {l.stats30d.views} <span className="sr-only">{t('card.views')}</span>
            </span>
            <span className="inline-flex items-center gap-1" title={t('card.reveals')}>
              <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
              {l.stats30d.reveals} <span className="sr-only">{t('card.reveals')}</span>
            </span>
            <span className="inline-flex items-center gap-1" title={t('card.saves')}>
              <Heart className="size-3.5" strokeWidth={1.5} aria-hidden />
              {l.stats30d.saves} <span className="sr-only">{t('card.saves')}</span>
            </span>
          </span>
        </div>
        {s === 'rejected' && l.rejectReason && (
          <p className="rounded-button border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger" role="note">
            <strong>{t('card.rejected')}:</strong> {l.rejectReason}
          </p>
        )}
        {s === 'stale' && <p className="rounded-button border border-accent bg-accent/15 px-3 py-2 text-small">{t('card.stale')}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {primary}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/account/listings/${l.id}/edit`}>
              <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
              {t('actions.edit')}
            </Link>
          </Button>
          {isPublic && (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/account/listings/${l.id}/stats`}>
                <BarChart3 className="size-4" strokeWidth={1.5} aria-hidden />
                {t('actions.stats')}
              </Link>
            </Button>
          )}
          {s === 'active' && <VipPurchaseButton listingId={l.id} vipUntil={l.vipUntil} />}
          <Popover
            open={menu}
            onOpenChange={setMenu}
            align="end"
            className="w-60 p-1"
            trigger={
              <Button size="sm" variant="ghost" aria-label={t('card.actionsLabel', { title: l.title })} loading={!!busy && !['confirm', 'pending_review'].includes(busy)}>
                <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
                {t('actions.more')}
              </Button>
            }
          >
            <ul className="flex flex-col">
              {isPublic && (
                <li>
                  <Link href={`/listings/${l.slug}`} className="flex items-center gap-2 rounded-[6px] px-3 py-2 text-[15px] hover:bg-surface-2">
                    <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
                    {t('actions.view')}
                  </Link>
                </li>
              )}
              {secondary.map((a) => (
                <li key={a.key}>
                  <button type="button" onClick={a.onClick} className={cn('flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-[15px] hover:bg-surface-2', a.danger && 'text-danger')}>
                    {a.key.toLowerCase().includes('slots') && <CalendarClock className="size-4" strokeWidth={1.5} aria-hidden />}
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          </Popover>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        size="sm"
        title={t('delete.title')}
        description={t('delete.description', { title: l.title })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('delete.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy === 'delete'}
              onClick={async () => {
                await run('delete', () => apiFetch(`/listings/${l.id}`, { method: 'DELETE' }), t('toast.deleted'));
                setConfirmDelete(false);
              }}
            >
              {t('delete.confirm')}
            </Button>
          </>
        }
      />
      <Drawer open={!!slots} onOpenChange={(o) => !o && setSlots(null)} title={slots === 'short_term' ? t('slots.shortTitle') : t('slots.viewingTitle')} className="max-w-3xl">
        <p className="mb-4 text-small text-muted">{t('slots.description', { title: l.title })}</p>
        {slots && <SlotsManager listingId={l.id} kind={slots} defaultPriceMinor={null} />}
      </Drawer>
    </article>
  );
}
