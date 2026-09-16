'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Building2, CalendarCheck, Clock, Heart, HandCoins, MessageSquare, Pencil, Phone, Share2, ShieldCheck } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { Avatar, Button, IconButton, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { useFavorites } from '../favorites';

type Props = { listing: ListingDetail & { canManage?: boolean } };

function usePhoneReveal(listingId: string) {
  const t = useTranslations('listing.contact');
  const [state, setState] = React.useState<{ loading: boolean; phone?: string | null; error?: string }>({ loading: false });
  const reveal = React.useCallback(async () => {
    setState({ loading: true });
    try {
      const r = await apiFetch<{ phone: string | null; name: string | null }>(`/listings/${listingId}/reveal-phone`, { method: 'POST' });
      setState({ loading: false, phone: r.phone });
    } catch (e) {
      setState({ loading: false, error: e instanceof ClientApiError ? (e.problem?.detail ?? e.problem?.title ?? t('revealError')) : t('revealError') });
    }
  }, [listingId, t]);
  return { ...state, reveal };
}

function useShare(listing: ListingDetail) {
  const t = useTranslations('listing.contact');
  const toast = useToast();
  return React.useCallback(async () => {
    const url = window.location.href.split('?')[0]!;
    void apiFetch(`/listings/${listing.id}/share`, { method: 'POST' }).catch(() => undefined);
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: t('copied'), tone: 'success' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast({ title: t('shareError'), tone: 'danger' });
    }
  }, [listing.id, listing.title, t, toast]);
}

const formatPhone = (p: string) => p.replace(/^\+995(\d{3})(\d{2})(\d{2})(\d{2})$/, '+995 $1 $2 $3 $4');

/** Sticky booking/contact card v2: big price, contact person, phone reveal, transaction CTAs, favorite & share. */
export function ContactCard({ listing: l }: Props) {
  const t = useTranslations('listing.contact');
  const th = useTranslations('listing.header');
  const fmt = useFormat();
  const fav = useFavorites();
  const phone = usePhoneReveal(l.id);
  const share = useShare(l);
  const isFav = fav.isFavorite(l.id);
  const c = l.contact;
  const profileHref = c.brokerSlug ? `/broker/${c.brokerSlug}` : null;
  const perM2 = l.pricePeriod === 'month' || l.pricePeriod === 'total' ? Math.round(l.priceMinor / l.areaM2) : null;
  return (
    <div className="card overflow-hidden shadow-md">
      <div className="p-5 md:p-6">
        <h2 className="sr-only">{t('title')}</h2>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[34px] font-bold leading-[1.1] tracking-tight tabular">
              {fmt.money(l.priceMinor, l.currency)}
              <span className="ml-1 text-[16px] font-medium tracking-normal text-muted">{fmt.period(l.pricePeriod)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted tabular">
              {perM2 !== null && <span>{th('perM2', { price: fmt.money(perM2, l.currency) })}</span>}
              {perM2 !== null && <span aria-hidden>·</span>}
              <span className="font-semibold text-text">{fmt.area(l.areaM2)}</span>
            </div>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold text-primary-soft-text">{fmt.dealType(l.dealType)}</span>
        </div>

        {l.lastConfirmedAt && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-[13.5px] font-medium text-success">
            <Clock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {th('confirmed', { when: fmt.relativeDays(l.lastConfirmedAt) })}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
          <Avatar src={c.avatarUrl} name={c.name} size={52} className="ring-4 ring-primary-soft" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold">{profileHref ? <Link href={profileHref} className="hover:text-link hover:underline">{c.name}</Link> : c.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-muted">
              <span className={cn('inline-flex items-center gap-1 font-medium', c.kind === 'owner' && 'text-success')}>
                {c.kind === 'owner' && <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />}
                {c.kind === 'owner' ? t('owner') : t('broker')}
              </span>
              {c.orgName && c.orgSlug && (
                <Link href={`/agency/${c.orgSlug}`} className="inline-flex min-w-0 items-center gap-1 truncate hover:text-link hover:underline">
                  <Building2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">{c.orgName}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div aria-live="polite" className="mt-5 flex flex-col gap-2">
          {phone.phone ? (
            <Button asChild size="lg" className="w-full">
              <a href={`tel:${phone.phone}`} aria-label={t('revealed', { phone: phone.phone })}>
                <Phone className="size-4" strokeWidth={2} aria-hidden />
                <span className="tabular">{formatPhone(phone.phone)}</span>
              </a>
            </Button>
          ) : phone.phone === null ? (
            <p className="rounded-xl bg-surface-2 px-3 py-3 text-center text-small text-muted">{t('noPhone')}</p>
          ) : (
            <Button size="lg" className="w-full" onClick={phone.reveal} loading={phone.loading} icon={<Phone className="size-4" strokeWidth={2} aria-hidden />}>
              {phone.loading ? t('revealing') : t('reveal')}
            </Button>
          )}
          {phone.error && (
            <p role="alert" className="text-small text-danger">
              {phone.error}
            </p>
          )}
        </div>

        <div className="mt-2 grid gap-2">
          <Button asChild variant="accent" className="w-full">
            <Link href={`/listings/${l.slug}/book`}>
              <CalendarCheck className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{t('book')}</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/listings/${l.slug}/offer`}>
              <HandCoins className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{t('offer')}</span>
            </Link>
          </Button>
        </div>
        <Button asChild variant="ghost" className="mt-1 w-full">
          <Link href={`/account/messages?listing=${l.id}`}>
            <MessageSquare className="size-4" strokeWidth={2} aria-hidden />
            {t('message')}
          </Link>
        </Button>

        <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-muted">
          <ShieldCheck className="mt-px size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
          {t('privacy')}
        </p>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-surface-2/60 px-5 py-3 md:px-6">
        <Button variant="ghost" size="sm" className="flex-1" aria-pressed={isFav} onClick={() => void fav.toggle(l.id)} icon={<Heart className={cn('size-4', isFav && 'fill-danger text-danger')} strokeWidth={2} aria-hidden />}>
          {isFav ? t('unfavorite') : t('favorite')}
        </Button>
        <IconButton label={t('share')} variant="ghost" size="sm" onClick={() => void share()}>
          <Share2 className="size-4" strokeWidth={2} />
        </IconButton>
        {l.canManage && (
          <IconButton label={t('edit')} variant="ghost" size="sm" asChild>
            <Link href={`/account/listings/${l.id}/edit`}>
              <Pencil className="size-4" strokeWidth={2} />
            </Link>
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** Mobile bottom action bar (hidden ≥ lg where the sticky aside is visible): price + book + phone reveal. */
export function MobileActionBar({ listing: l }: Props) {
  const t = useTranslations('listing.contact');
  const fmt = useFormat();
  const phone = usePhoneReveal(l.id);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 shadow-lg backdrop-blur-md lg:hidden" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-4 pt-3" aria-live="polite">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-bold leading-tight tracking-tight tabular">
            {fmt.money(l.priceMinor, l.currency)}
            <span className="ml-0.5 text-[13px] font-medium text-muted">{fmt.period(l.pricePeriod)}</span>
          </div>
          <div className="truncate text-[12.5px] text-muted tabular">{fmt.area(l.areaM2)}</div>
        </div>
        <IconButton label={t('book')} variant="secondary" asChild className="shrink-0">
          <Link href={`/listings/${l.slug}/book`}>
            <CalendarCheck className="size-5" strokeWidth={2} />
          </Link>
        </IconButton>
        {phone.phone ? (
          <Button asChild className="shrink-0">
            <a href={`tel:${phone.phone}`}>
              <Phone className="size-4" strokeWidth={2} aria-hidden />
              {t('call')}
            </a>
          </Button>
        ) : (
          <Button className="shrink-0 px-4" onClick={phone.reveal} loading={phone.loading} disabled={phone.phone === null} icon={<Phone className="size-4" strokeWidth={2} aria-hidden />}>
            {phone.phone === null ? t('noPhone') : t('call')}
          </Button>
        )}
      </div>
      {phone.error && (
        <p role="alert" className="mx-auto mt-1 max-w-[1240px] px-4 text-small text-danger">
          {phone.error}
        </p>
      )}
    </div>
  );
}
