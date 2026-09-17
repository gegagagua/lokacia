'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Archive, BarChart3, Building2, CalendarClock, CheckCircle2, ExternalLink, Eye, EyeOff, Heart, ImageOff, MapPin, MoreHorizontal, Pencil, Phone, Plus, RotateCcw, SearchX, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import type { ListingCard, ListingStatus } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Dialog, Drawer, Popover, Skeleton, VipBadge, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { VipPurchaseButton } from '@/components/billing/vip-button';
import { AccountPageHeader } from '../page-header';
import { ListingStatusBadge } from '../status-badges';
import { SlotsManager } from './slots-manager';
import { AccountEmpty, IconTile, Segmented, Thumb } from '../ui';
import { withBase } from '@/lib/base-path';

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
  const f = useFormat();
  const params = useSearchParams();
  const { data, isLoading, mutate } = useSWR<MyListing[]>('/listings/mine', fetcher);
  const [filter, setFilter] = React.useState(() => {
    const s = params.get('status');
    return s === 'rejected' || s === 'stale' ? 'attention' : s === 'draft' ? 'drafts' : s === 'pending_review' ? 'review' : s === 'active' ? 'active' : 'all';
  });
  const items = data ?? [];
  const current = FILTERS.find((x) => x.key === filter)!;
  const shown = current.statuses ? items.filter((i) => current.statuses!.includes(i.status)) : items;
  const sum = (k: 'views' | 'reveals' | 'saves') => items.reduce((a, i) => a + (i.stats30d?.[k] ?? 0), 0);

  return (
    <div>
      <AccountPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button asChild>
            <Link href="/account/listings/new">
              <Plus className="size-4" strokeWidth={2.25} aria-hidden />
              {t('publish')}
            </Link>
          </Button>
        }
      />

      {items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: Building2, tone: 'primary' as const, label: t('summary.active'), value: items.filter((i) => i.status === 'active').length },
            { icon: Eye, tone: 'link' as const, label: t('summary.views'), value: sum('views') },
            { icon: Phone, tone: 'success' as const, label: t('summary.reveals'), value: sum('reveals') },
            { icon: Heart, tone: 'danger' as const, label: t('summary.saves'), value: sum('saves') },
          ].map((k) => (
            <div key={k.label} className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
              <IconTile icon={k.icon} tone={k.tone} />
              <div className="min-w-0">
                <div className="text-[22px] font-bold leading-7 tabular">{f.number(k.value)}</div>
                <div className="text-[13px] leading-tight text-muted">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Segmented
          role="tablist"
          label={t('filters.label')}
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((x) => ({ value: x.key, label: t(`filters.${x.key}`), count: x.statuses ? items.filter((i) => x.statuses!.includes(i.status)).length : items.length }))}
          className="max-w-none"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <AccountEmpty
          icon={Building2}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button asChild>
              <Link href="/account/listings/new">
                <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                {t('publish')}
              </Link>
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <AccountEmpty icon={SearchX} tone="neutral" title={t('empty.filtered')} />
      ) : (
        <ul className="flex flex-col gap-4">
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
        window.setTimeout(() => (window.location.href = withBase(lp(`/account/listings/${l.id}/edit?step=passport`))), 1500);
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
      <Button key="confirm" size="sm" variant={s === 'stale' ? 'primary' : 'secondary'} loading={busy === 'confirm'} onClick={confirmOwner} icon={<CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />}>
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
    <article className={cn('card group overflow-hidden transition-shadow duration-200 hover:shadow-md', (s === 'stale' || s === 'rejected') && 'ring-1 ring-inset', s === 'stale' && 'ring-accent/60', s === 'rejected' && 'ring-danger/40')}>
      <div className="flex flex-col sm:flex-row">
        <Link href={`/account/listings/${l.id}/edit`} className="relative block shrink-0 p-3 pb-0 sm:w-60 sm:pb-3 sm:pr-0" tabIndex={-1} aria-hidden>
          <Thumb src={l.cover} className="aspect-[16/10] w-full sm:aspect-[4/3] sm:h-full" />
          {!l.cover && (
            <span className="absolute inset-3 grid place-items-center text-small font-medium text-muted sm:right-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 shadow-xs">
                <ImageOff className="size-4" strokeWidth={2} aria-hidden />
                {t('card.noPhoto')}
              </span>
            </span>
          )}
          <span className="absolute left-5 top-5 flex gap-1.5">{l.vip && <VipBadge />}</span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={s} />
            <span className="inline-flex items-center gap-1 text-[13px] text-muted">
              <ShieldCheck className={cn('size-3.5', l.lastConfirmedAt ? 'text-success' : 'text-muted')} strokeWidth={2} aria-hidden />
              {l.lastConfirmedAt ? t('card.confirmed', { when: f.relativeDays(l.lastConfirmedAt) }) : t('card.notConfirmed')}
            </span>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold leading-snug tracking-tight">
                <Link href={isPublic ? `/listings/${l.slug}` : `/account/listings/${l.id}/edit`} className="line-clamp-2 hover:text-link">
                  {l.title}
                </Link>
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-small text-muted">
                <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="truncate">{[l.districtName, l.address].filter(Boolean).join(' · ')}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0 tabular">{f.area(l.areaM2)}</span>
              </p>
            </div>
            <div className="shrink-0 whitespace-nowrap text-[22px] font-bold leading-7 tracking-tight tabular lg:text-right">
              {f.money(l.priceMinor, l.currency)}
              {l.pricePeriod === 'month' && <span className="text-small font-medium text-muted"> {t('card.perMonth')}</span>}
            </div>
          </div>

          <ul className="flex flex-wrap items-center gap-2" aria-label={t('card.stats30d')}>
            {[
              { icon: Eye, v: l.stats30d.views, label: t('card.views') },
              { icon: Phone, v: l.stats30d.reveals, label: t('card.reveals') },
              { icon: Heart, v: l.stats30d.saves, label: t('card.saves') },
            ].map((x) => (
              <li key={x.label} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13.5px] tabular" title={x.label}>
                <x.icon className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
                <span className="font-bold">{f.number(x.v)}</span>
                <span className="text-muted">{x.label}</span>
              </li>
            ))}
            <li className="text-[12.5px] font-medium text-muted">{t('card.stats30d')}</li>
          </ul>

          {s === 'rejected' && l.rejectReason && (
            <p className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-small text-danger" role="note">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                <strong>{t('card.rejected')}:</strong> {l.rejectReason}
              </span>
            </p>
          )}
          {s === 'stale' && (
            <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-small">
              <EyeOff className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t('card.stale')}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {primary}
            <Button asChild size="sm" variant="secondary">
              <Link href={`/account/listings/${l.id}/edit`}>
                <Pencil className="size-4" strokeWidth={2} aria-hidden />
                {t('actions.edit')}
              </Link>
            </Button>
            {isPublic && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/account/listings/${l.id}/stats`}>
                  <BarChart3 className="size-4" strokeWidth={2} aria-hidden />
                  {t('actions.stats')}
                </Link>
              </Button>
            )}
            {s === 'active' && <VipPurchaseButton listingId={l.id} vipUntil={l.vipUntil} />}
            <Popover
              open={menu}
              onOpenChange={setMenu}
              align="end"
              className="w-64 p-1.5"
              trigger={
                <Button size="sm" variant="ghost" className="sm:ml-auto" aria-label={t('card.actionsLabel', { title: l.title })} loading={!!busy && !['confirm', 'pending_review'].includes(busy)}>
                  <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
                  {t('actions.more')}
                </Button>
              }
            >
              <ul className="flex flex-col">
                {isPublic && (
                  <li>
                    <Link href={`/listings/${l.slug}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] hover:bg-surface-2">
                      <ExternalLink className="size-4 text-muted" strokeWidth={2} aria-hidden />
                      {t('actions.view')}
                    </Link>
                  </li>
                )}
                {secondary.map((a) => {
                  const Icon = a.key === 'delete' ? Trash2 : a.key.toLowerCase().includes('slots') ? CalendarClock : a.key === 'archive' ? Archive : a.key === 'restore' ? RotateCcw : CheckCircle2;
                  return (
                    <li key={a.key}>
                      {a.danger && <div className="my-1 h-px bg-border" aria-hidden />}
                      <button type="button" onClick={a.onClick} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-surface-2', a.danger && 'text-danger hover:bg-danger/10')}>
                        <Icon className={cn('size-4', !a.danger && 'text-muted')} strokeWidth={2} aria-hidden />
                        {a.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Popover>
          </div>
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
