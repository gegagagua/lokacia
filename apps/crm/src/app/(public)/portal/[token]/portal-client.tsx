'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Heart, LayoutGrid, MapPin, Phone, Ruler, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatArea, formatMoney, type PortalView } from '@lokacia/contracts';
import { Button, cn, EmptyState, Logo, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { PersonAvatar } from '@/components/common/ui';
import { heroProps, OrgBrandMark, validBrand } from '../../brand';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
type Item = PortalView['items'][number];

export function PortalClient({ token, initial }: { token: string; initial: PortalView }) {
  const t = useTranslations('portal');
  const [items, setItems] = React.useState(initial.items);
  const liked = items.filter((i) => i.status === 'liked').length;
  const disliked = items.filter((i) => i.status === 'disliked').length;
  const brand = validBrand(initial.org.brandColor);
  const hero = heroProps(brand);
  const agent = initial.agent;

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-30 border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <OrgBrandMark name={initial.org.name} logoUrl={initial.org.logoUrl} brand={brand} size={36} />
            <span className="truncate text-[17px] font-bold tracking-tight">{initial.org.name}</span>
          </div>
          {agent?.phone && (
            <Button asChild size="sm" className="rounded-full">
              <a href={`tel:${agent.phone}`} aria-label={t('callAgent')}>
                <Phone className="size-4" strokeWidth={2} aria-hidden />
                <span className="hidden tabular sm:inline">{agent.phone}</span>
              </a>
            </Button>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-4 md:px-6 md:pt-6">
        <div className={cn('relative overflow-hidden rounded-modal px-5 py-8 shadow-md md:px-10 md:py-12', hero.className)} style={hero.style}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute -right-4 top-10 size-40 rounded-full border border-white/10" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20">
                <Heart className="size-3.5" strokeWidth={2} aria-hidden />
                {t('eyebrow')}
              </span>
              <h1 className="mt-4 text-[34px] font-bold leading-[1.15] tracking-tight text-white md:text-h1">{t('greeting', { name: initial.contact.firstName })}</h1>
              <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-white/80 md:text-[17px]">{t('intro')}</p>
              {items.length > 0 && (
                <dl className="mt-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
                  {[
                    { label: t('statTotal'), value: items.length, icon: LayoutGrid },
                    { label: t('statLiked'), value: liked, icon: ThumbsUp },
                    { label: t('statDisliked'), value: disliked, icon: ThumbsDown },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2 ring-1 sm:pl-2 sm:pr-4 ring-inset ring-white/15 backdrop-blur-sm">
                        <span className="hidden size-9 place-items-center rounded-xl bg-white/15 sm:grid" aria-hidden>
                          <Icon className="size-4 text-white" strokeWidth={2} />
                        </span>
                        <div className="flex min-w-0 flex-col-reverse">
                          <dt className="truncate text-[12.5px] leading-4 text-white/70">{s.label}</dt>
                          <dd className="text-[20px] font-bold leading-6 tabular text-white">{s.value}</dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              )}
            </div>
            {agent && (
              <div className="rounded-card bg-surface p-5 text-text shadow-lg">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={agent.name} size={52} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-muted">{t('agent')}</div>
                    <div className="truncate text-[17px] font-bold">{agent.name}</div>
                    <div className="truncate text-[13px] text-muted">{initial.org.name}</div>
                  </div>
                </div>
                {agent.phone && (
                  <Button asChild className="mt-4 w-full rounded-full">
                    <a href={`tel:${agent.phone}`}>
                      <Phone className="size-4" strokeWidth={2} aria-hidden />
                      {t('call')} · <span className="tabular">{agent.phone}</span>
                    </a>
                  </Button>
                )}
                {initial.org.phone && initial.org.phone !== agent.phone && (
                  <p className="mt-3 text-center text-[13px] text-muted">
                    {t('contactOrg')}:{' '}
                    <a href={`tel:${initial.org.phone}`} className="font-medium text-link tabular hover:underline">
                      {initial.org.phone}
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        {items.length === 0 ? (
          <EmptyState title={t('empty')} description={t('emptyHint')} />
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-[26px] font-bold tracking-tight md:text-h2">{t('listTitle')}</h2>
              <p className="mt-1 max-w-2xl text-muted">{t('listHint')}</p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <PortalCard key={item.matchId} token={token} item={item} onChange={(next) => setItems((s) => s.map((x) => (x.matchId === next.matchId ? next : x)))} />
              ))}
            </ul>
          </>
        )}
      </div>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-small text-muted sm:flex-row md:px-6">
          <span className="flex items-center gap-2">
            <OrgBrandMark name={initial.org.name} logoUrl={initial.org.logoUrl} brand={brand} size={24} />
            <span className="font-medium text-text">{initial.org.name}</span>
          </span>
          <span className="flex items-center gap-2">
            {t('poweredBy')} <Logo size={18} showGeorgian={false} />
          </span>
        </div>
      </footer>
    </div>
  );
}

function PortalCard({ token, item, onChange }: { token: string; item: Item; onChange: (i: Item) => void }) {
  const t = useTranslations('portal');
  const toast = useToast();
  const [comment, setComment] = React.useState(item.comment ?? '');
  const [busy, setBusy] = React.useState(false);
  const l = item.listing;
  const isLiked = item.status === 'liked';
  const isDisliked = item.status === 'disliked';

  const react = async (reaction: 'liked' | 'disliked', withComment = false) => {
    setBusy(true);
    try {
      const r = await apiFetch<{ status: Item['status']; comment: string | null }>(`/crm/portal/${encodeURIComponent(token)}/matches/${item.matchId}`, {
        method: 'POST',
        noOrg: true,
        body: { reaction, comment: withComment ? comment.trim() || null : undefined },
      });
      onChange({ ...item, status: r.status, comment: r.comment });
      toast({ title: t('saved'), tone: 'success' });
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border bg-surface shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md',
        isLiked ? 'border-success/60 ring-2 ring-success/25' : 'border-border',
        isDisliked && 'opacity-75 hover:opacity-100',
      )}
    >
      <div className="relative p-2 pb-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-photo bg-surface-2">
          {l.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.cover} alt={l.title} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" loading="lazy" />
          ) : (
            <div className="drawing-grid size-full" />
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="absolute bottom-3 left-3 rounded-full bg-surface/95 px-3 py-1.5 text-[15px] font-bold tabular text-text shadow-sm">
            {formatMoney(l.priceMinor)}
            {l.pricePeriod === 'month' && <span className="ml-1 text-[12.5px] font-medium text-muted">{t('perMonth')}</span>}
          </div>
          {(isLiked || isDisliked) && (
            <span className={cn('absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-surface shadow-sm', isLiked ? 'bg-success' : 'bg-danger')}>
              {isLiked ? <ThumbsUp className="size-3.5" strokeWidth={2.2} aria-hidden /> : <ThumbsDown className="size-3.5" strokeWidth={2.2} aria-hidden />}
              {isLiked ? t('statusLiked') : t('statusDisliked')}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-3.5">
        <div>
          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug">{l.title}</h3>
          <p className="mt-1 flex items-center gap-1 truncate text-[13.5px] text-muted">
            <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">
              {l.districtName ? `${l.districtName} · ` : ''}
              {l.address}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-[13px] font-semibold text-primary-soft-text tabular">
            <Ruler className="size-3.5" strokeWidth={2} aria-hidden />
            <span className="sr-only">{t('area')}:</span>
            {formatArea(l.areaM2)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={l.title}>
          <button
            type="button"
            aria-pressed={isLiked}
            disabled={busy}
            onClick={() => react('liked')}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 text-[15px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none active:scale-[0.97] disabled:opacity-60',
              isLiked ? 'border-success bg-success text-surface shadow-md' : 'border-border bg-surface text-text hover:border-success/60 hover:bg-success/8 hover:text-success',
            )}
          >
            <ThumbsUp className={cn('size-5 transition-transform', isLiked && 'scale-110')} strokeWidth={2} aria-hidden />
            {t('like')}
          </button>
          <button
            type="button"
            aria-pressed={isDisliked}
            disabled={busy}
            onClick={() => react('disliked')}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 text-[15px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none active:scale-[0.97] disabled:opacity-60',
              isDisliked ? 'border-danger bg-danger text-surface shadow-md' : 'border-border bg-surface text-text hover:border-danger/60 hover:bg-danger/8 hover:text-danger',
            )}
          >
            <ThumbsDown className={cn('size-5 transition-transform', isDisliked && 'scale-110')} strokeWidth={2} aria-hidden />
            {t('dislike')}
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor={`c-${item.matchId}`}>
            {t('comment')}
          </label>
          <div className="relative">
            <Textarea id={`c-${item.matchId}`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentPlaceholder')} className="min-h-20 pr-12 text-[14px]" maxLength={1000} />
            <button
              type="button"
              aria-label={t('saveComment')}
              title={t('saveComment')}
              disabled={busy || !comment.trim() || comment.trim() === (item.comment ?? '')}
              onClick={() => react(isDisliked ? 'disliked' : 'liked', true)}
              className="absolute bottom-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-primary text-primary-contrast shadow-sm transition-all hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted disabled:shadow-none"
            >
              <Send className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 self-start text-[14px] font-semibold text-link hover:underline">
          {t('details')} <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </li>
  );
}
