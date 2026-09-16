'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Phone, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatArea, formatMoney, type PortalView } from '@lokacia/contracts';
import { Button, cn, EmptyState, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
type Item = PortalView['items'][number];

export function PortalClient({ token, initial }: { token: string; initial: PortalView }) {
  const t = useTranslations('portal');
  const [items, setItems] = React.useState(initial.items);
  const liked = items.filter((i) => i.status === 'liked').length;
  const disliked = items.filter((i) => i.status === 'disliked').length;
  const brand = initial.org.brandColor && /^#[0-9a-f]{6}$/i.test(initial.org.brandColor) ? initial.org.brandColor : 'var(--primary)';
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface" style={{ borderTop: `3px solid ${brand}` }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            {initial.org.logoUrl ? <img src={initial.org.logoUrl} alt="" className="size-10 rounded-[6px] border border-border object-contain" /> : null}
            <div className="compact text-h3 font-semibold">{initial.org.name}</div>
          </div>
          {initial.agent && (
            <div className="flex items-center gap-3 text-small">
              <div className="text-right">
                <div className="text-muted">{t('agent')}</div>
                <div className="font-medium">{initial.agent.name}</div>
              </div>
              {initial.agent.phone && (
                <Button asChild size="sm" variant="secondary">
                  <a href={`tel:${initial.agent.phone}`}>
                    <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
                    <span className="tabular">{initial.agent.phone}</span>
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="compact text-h2 font-semibold">{t('greeting', { name: initial.contact.firstName })}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t('intro')}</p>
        {items.length > 0 && <p className="mt-2 text-small text-muted tabular">{t('counts', { liked, disliked, total: items.length })}</p>}
        {items.length === 0 ? (
          <EmptyState className="mt-6" title={t('empty')} description={t('emptyHint')} />
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <PortalCard key={item.matchId} token={token} item={item} onChange={(next) => setItems((s) => s.map((x) => (x.matchId === next.matchId ? next : x)))} />
            ))}
          </ul>
        )}
        <p className="mt-10 text-center text-small text-muted">{t('poweredBy')}</p>
      </div>
    </div>
  );
}

function PortalCard({ token, item, onChange }: { token: string; item: Item; onChange: (i: Item) => void }) {
  const t = useTranslations('portal');
  const toast = useToast();
  const [comment, setComment] = React.useState(item.comment ?? '');
  const [busy, setBusy] = React.useState(false);
  const l = item.listing;

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
    <li className={cn('flex flex-col overflow-hidden rounded-card border bg-surface', item.status === 'liked' ? 'border-success' : item.status === 'disliked' ? 'border-border opacity-80' : 'border-border')}>
      <div className="aspect-[4/3] bg-surface-2">{l.cover ? <img src={l.cover} alt={l.title} className="size-full rounded-t-photo object-cover" loading="lazy" /> : <div className="drawing-grid size-full" />}</div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h2 className="line-clamp-2 font-semibold leading-snug">{l.title}</h2>
          <p className="truncate text-small text-muted">{l.districtName ? `${l.districtName} · ` : ''}{l.address}</p>
        </div>
        <div className="flex items-baseline justify-between tabular">
          <span className="compact text-h3 font-semibold">
            {formatMoney(l.priceMinor)}
            {l.pricePeriod === 'month' && <span className="ml-1 text-small font-normal text-muted">{t('perMonth')}</span>}
          </span>
          <span className="text-muted">{formatArea(l.areaM2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={l.title}>
          <Button variant={item.status === 'liked' ? 'primary' : 'secondary'} aria-pressed={item.status === 'liked'} disabled={busy} onClick={() => react('liked')} icon={<ThumbsUp className="size-4" strokeWidth={1.5} aria-hidden />}>
            {t('like')}
          </Button>
          <Button variant={item.status === 'disliked' ? 'danger' : 'secondary'} aria-pressed={item.status === 'disliked'} disabled={busy} onClick={() => react('disliked')} icon={<ThumbsDown className="size-4" strokeWidth={1.5} aria-hidden />}>
            {t('dislike')}
          </Button>
        </div>
        <label className="text-small font-medium" htmlFor={`c-${item.matchId}`}>
          {t('comment')}
        </label>
        <Textarea id={`c-${item.matchId}`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentPlaceholder')} className="min-h-16 text-[14px]" maxLength={1000} />
        <div className="mt-auto flex items-center justify-between gap-2">
          <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-small text-link hover:underline">
            {t('details')} <ExternalLink className="size-3" strokeWidth={1.5} aria-hidden />
          </a>
          <Button size="sm" variant="ghost" disabled={busy || !comment.trim() || comment.trim() === (item.comment ?? '')} onClick={() => react(item.status === 'disliked' ? 'disliked' : 'liked', true)}>
            {t('saveComment')}
          </Button>
        </div>
      </div>
    </li>
  );
}
