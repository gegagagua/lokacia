import * as React from 'react';
import { BadgeCheck, Building2, Camera, Clock, MapPin, Heart } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatMoney, formatDateKa, relativeDaysKa, type ListingCard as Card } from '@lokacia/contracts';
import { cn } from '../lib/cn';
import { Badge, VipBadge } from './display';
import { SpacePlan } from './space-plan';

export function PriceTag({ priceMinor, currency = 'GEL', period, areaM2, size = 'md', className }: { priceMinor: number; currency?: string; period?: 'month' | 'total' | 'day' | 'hour'; areaM2?: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const perM2 = areaM2 ? Math.round(priceMinor / areaM2 / 100) * 100 : null;
  const suffix = period === 'month' ? ' / თვე' : period === 'day' ? ' / დღე' : period === 'hour' ? ' / სთ' : '';
  return (
    <div className={cn('flex flex-col', className)}>
      <span className={cn('compact font-semibold tabular leading-tight', size === 'lg' ? 'text-h1' : size === 'sm' ? 'text-[18px]' : 'text-h3')}>
        {formatMoney(priceMinor, currency)}
        <span className="text-small font-normal text-muted">{suffix}</span>
      </span>
      {perM2 !== null && <span className="text-small text-muted tabular">{formatMoney(perM2, currency)} / მ²</span>}
    </div>
  );
}

export type ListingCardProps = {
  listing: Card;
  href: string;
  businessTypeName?: (slug: string) => string;
  onFavorite?: () => void;
  favorite?: boolean;
  layout?: 'grid' | 'row';
  className?: string;
  priority?: boolean;
  LinkComponent?: React.ElementType;
};

/** Listing card: SpacePlan header (signature), cover strip, price, trust signals. */
export function ListingCard({ listing: l, href, businessTypeName, onFavorite, favorite, layout = 'grid', className, priority, LinkComponent = 'a' }: ListingCardProps) {
  const Link = LinkComponent;
  return (
    <article className={cn('group relative flex overflow-hidden rounded-card border border-border bg-surface transition-colors duration-150 hover:border-border-strong', layout === 'grid' ? 'flex-col' : 'flex-col sm:flex-row', className)}>
      <div className={cn('relative grid shrink-0 grid-cols-2 border-b border-border sm:border-b-0', layout === 'row' ? 'sm:w-[420px] sm:border-r' : '')}>
        <div className="drawing-grid bg-bg p-2">
          <SpacePlan compact areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} />
        </div>
        <div className="relative bg-surface-2">
          {l.cover ? (
            <img src={l.cover} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchPriority: 'high' as const } : {})} className="absolute inset-0 size-full rounded-none object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-muted">
              <Building2 className="size-8" strokeWidth={1.5} aria-hidden />
            </div>
          )}
          {l.photosCount > 0 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[4px] bg-basalt/80 px-1.5 py-0.5 text-[11px] text-plaster tabular">
              <Camera className="size-3" strokeWidth={1.5} aria-hidden />
              {l.photosCount}
            </span>
          )}
        </div>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">{l.vip && <VipBadge />}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={l.dealType === 'transfer' ? 'link' : 'outline'}>{DEAL_TYPE_LABELS_KA[l.dealType]}</Badge>
          {l.businessTypes.slice(0, 2).map((b) => (
            <Badge key={b} tone="neutral">
              {businessTypeName?.(b) ?? b}
            </Badge>
          ))}
          {l.offPlan && <Badge tone="primary">მშენებლე{l.completionDate ? ` · ${formatDateKa(l.completionDate).split(',')[1]?.trim() ?? ''}` : ''}</Badge>}
        </div>
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {l.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1 text-small text-muted">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="truncate">{l.districtName ? `${l.districtName} · ` : ''}{l.address}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.pricePeriod === 'month' ? l.areaM2 : undefined} />
          <div className="flex flex-col items-end gap-1 text-right text-[12px] text-muted">
            {l.isOwner ? (
              <span className={cn('inline-flex items-center gap-1', l.verifiedOwner && 'text-success')}>
                {l.verifiedOwner && <BadgeCheck className="size-3.5" strokeWidth={1.5} aria-hidden />}
                {l.verifiedOwner ? 'ვერიფ. მესაკუთრე' : 'მესაკუთრე'}
              </span>
            ) : (
              <span>ბროკერი{l.commissionPct ? ` · ${l.commissionPct}%` : ''}</span>
            )}
            {l.lastConfirmedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" strokeWidth={1.5} aria-hidden />
                დადასტურდა {relativeDaysKa(l.lastConfirmedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
      {onFavorite && (
        <button type="button" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? 'ფავორიტებიდან წაშლა' : 'ფავორიტებში დამატება'} className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full border border-border bg-surface/90 text-text hover:bg-surface">
          <Heart className={cn('size-4', favorite && 'fill-danger text-danger')} strokeWidth={1.5} />
        </button>
      )}
    </article>
  );
}
