import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck, MapPin } from 'lucide-react';
import { SERVICE_CATEGORIES, type ProviderDto } from '@lokacia/contracts';
import { Avatar, Badge } from '@lokacia/ui';
import { CITY_NAMES_KA } from '@/lib/site';

export const categoryName = (slug: string) => SERVICE_CATEGORIES.find((c) => c.slug === slug)?.nameKa ?? slug;

/** Five stars with an accessible label. */
export function Stars({ rating, count, className }: { rating: number; count?: number; className?: string }) {
  const t = useTranslations('services.provider');
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`} role="img" aria-label={t('rating', { rating: rating.toFixed(1), count: count ?? 0 })}>
      <span aria-hidden className="tracking-tight text-accent">
        {'★'.repeat(full)}
        <span className="text-border-strong">{'★'.repeat(Math.max(0, 5 - full))}</span>
      </span>
      <span aria-hidden className="text-small tabular text-muted">
        {rating.toFixed(1)}
        {count !== undefined ? ` (${count})` : ''}
      </span>
    </span>
  );
}

export function ProviderCard({ p }: { p: ProviderDto }) {
  const t = useTranslations('services.provider');
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Avatar src={p.logoUrl} name={p.name} size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">
            <Link href={`/services/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {p.name}
            </Link>
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars rating={p.rating} count={p.reviewsCount} />
            {p.verified && (
              <span className="inline-flex items-center gap-1 text-small text-success">
                <BadgeCheck className="size-3.5" strokeWidth={1.5} aria-hidden />
                {t('verified')}
              </span>
            )}
          </div>
        </div>
      </div>
      {p.about && <p className="line-clamp-2 text-small text-muted">{p.about}</p>}
      <div className="flex flex-wrap gap-1.5">
        {p.categories.map((c) => (
          <Badge key={c} tone="neutral">
            {categoryName(c)}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-small text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden />
          {CITY_NAMES_KA[p.city] ?? p.city}
          {p.completedOrders > 0 && ` · ${t('completed', { count: p.completedOrders })}`}
        </span>
        {p.priceFrom && <span className="font-medium text-text tabular">{p.priceFrom}</span>}
      </div>
    </article>
  );
}
