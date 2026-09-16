'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Heart, HandCoins, MessageSquare, Pencil, Phone, Share2 } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { Avatar, Badge, Button, IconButton, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
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

/** Sticky contact card (desktop aside): contact, phone reveal, favorite, share, transaction CTAs. */
export function ContactCard({ listing: l }: Props) {
  const t = useTranslations('listing.contact');
  const fav = useFavorites();
  const phone = usePhoneReveal(l.id);
  const share = useShare(l);
  const isFav = fav.isFavorite(l.id);
  const c = l.contact;
  const profileHref = c.brokerSlug ? `/broker/${c.brokerSlug}` : null;
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <h2 className="text-small font-medium uppercase tracking-wide text-muted">{t('title')}</h2>
      <div className="flex items-center gap-3">
        <Avatar src={c.avatarUrl} name={c.name} size={48} />
        <div className="min-w-0">
          <div className="truncate font-medium">{profileHref ? <Link href={profileHref} className="hover:text-link hover:underline">{c.name}</Link> : c.name}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-small text-muted">
            <Badge tone={c.kind === 'owner' ? 'primary' : 'outline'}>{c.kind === 'owner' ? t('owner') : t('broker')}</Badge>
            {c.orgName && c.orgSlug && (
              <Link href={`/agency/${c.orgSlug}`} className="truncate hover:text-link hover:underline">
                {c.orgName}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {phone.phone ? (
          <Button asChild size="lg" icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}>
            <a href={`tel:${phone.phone}`} aria-label={t('revealed', { phone: phone.phone })}>
              <span className="tabular">{formatPhone(phone.phone)}</span>
            </a>
          </Button>
        ) : phone.phone === null ? (
          <p className="text-small text-muted">{t('noPhone')}</p>
        ) : (
          <Button size="lg" onClick={phone.reveal} loading={phone.loading} icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}>
            {phone.loading ? t('revealing') : t('reveal')}
          </Button>
        )}
        {phone.error && (
          <p role="alert" className="text-small text-danger">
            {phone.error}
          </p>
        )}
        <p className="text-small text-muted">{t('privacy')}</p>
      </div>

      <div className="grid gap-2">
        <Button asChild variant="secondary" icon={<CalendarCheck className="size-4" strokeWidth={1.5} aria-hidden />}>
          <Link href={`/listings/${l.slug}/book`}>{t('book')}</Link>
        </Button>
        <Button asChild variant="secondary" icon={<HandCoins className="size-4" strokeWidth={1.5} aria-hidden />}>
          <Link href={`/listings/${l.slug}/offer`}>{t('offer')}</Link>
        </Button>
        <Button asChild variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={1.5} aria-hidden />}>
          <Link href={`/account/messages?listing=${l.id}`}>{t('message')}</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button variant="secondary" size="sm" className="flex-1" aria-pressed={isFav} onClick={() => void fav.toggle(l.id)} icon={<Heart className={cn('size-4', isFav && 'fill-danger text-danger')} strokeWidth={1.5} aria-hidden />}>
          {isFav ? t('unfavorite') : t('favorite')}
        </Button>
        <IconButton label={t('share')} variant="secondary" size="sm" onClick={() => void share()}>
          <Share2 className="size-4" strokeWidth={1.5} />
        </IconButton>
        {l.canManage && (
          <IconButton label={t('edit')} variant="secondary" size="sm" asChild>
            <Link href={`/account/listings/${l.id}/edit`}>
              <Pencil className="size-4" strokeWidth={1.5} />
            </Link>
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** Mobile bottom action bar (hidden ≥ lg where the sticky aside is visible). */
export function MobileActionBar({ listing: l }: Props) {
  const t = useTranslations('listing.contact');
  const fav = useFavorites();
  const phone = usePhoneReveal(l.id);
  const isFav = fav.isFavorite(l.id);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-[1200px] items-center gap-2" aria-live="polite">
        <IconButton label={isFav ? t('unfavorite') : t('favorite')} variant="secondary" aria-pressed={isFav} onClick={() => void fav.toggle(l.id)}>
          <Heart className={cn('size-5', isFav && 'fill-danger text-danger')} strokeWidth={1.5} />
        </IconButton>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/listings/${l.slug}/book`}>{t('book')}</Link>
        </Button>
        {phone.phone ? (
          <Button asChild className="flex-1" icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}>
            <a href={`tel:${phone.phone}`}>{t('call')}</a>
          </Button>
        ) : (
          <Button className="flex-1" onClick={phone.reveal} loading={phone.loading} disabled={phone.phone === null} icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}>
            {phone.phone === null ? t('noPhone') : t('reveal')}
          </Button>
        )}
      </div>
      {phone.error && (
        <p role="alert" className="mx-auto mt-1 max-w-[1200px] text-small text-danger">
          {phone.error}
        </p>
      )}
    </div>
  );
}
