import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck, MapPin } from 'lucide-react';
import { SERVICE_CATEGORIES, type ProviderDto } from '@lokacia/contracts';
import { Avatar, Badge } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';

export const categoryName = (slug: string) => SERVICE_CATEGORIES.find((c) => c.slug === slug)?.nameKa ?? slug;

/** Localized service category label (falls back to the Georgian taxonomy name). */
export function useCategoryName() {
  const t = useTranslations('services.categories');
  return (slug: string) => (t.has(slug) ? t(slug) : categoryName(slug));
}

/** Five stars with an accessible label. */
export function Stars({ rating, count, className }: { rating: number; count?: number; className?: string }) {
  const t = useTranslations('services.provider');
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`} role="img" aria-label={t('rating', { rating: rating.toFixed(1), count: count ?? 0 })}>
      <span aria-hidden className="text-[15px] tracking-tight text-accent">
        {'★'.repeat(full)}
        <span className="text-border-strong">{'★'.repeat(Math.max(0, 5 - full))}</span>
      </span>
      <span aria-hidden className="text-small font-medium tabular text-muted">
        {rating.toFixed(1)}
        {count !== undefined ? ` (${count})` : ''}
      </span>
    </span>
  );
}

export function ProviderCard({ p }: { p: ProviderDto }) {
  const t = useTranslations('services.provider');
  const f = useFormat();
  const catName = useCategoryName();
  return (
    <article className="card card-hover relative flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3.5">
        <span className="relative">
          <Avatar src={p.logoUrl} name={p.name} size={56} className="text-[17px] ring-4 ring-primary-soft" />
          {p.verified && (
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-surface text-success shadow-sm">
              <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">
            <Link href={`/services/${p.slug}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
              {p.name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars rating={p.rating} count={p.reviewsCount} />
            {p.verified && <span className="text-small font-medium text-success">{t('verified')}</span>}
          </div>
        </div>
      </div>
      {p.about && <p className="line-clamp-2 text-[15px] text-muted">{p.about}</p>}
      <div className="flex flex-wrap gap-1.5">
        {p.categories.map((c) => (
          <Badge key={c} tone="primary">
            {catName(c)}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-small text-muted">
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
          <span className="truncate">
            {f.city(p.city)}
            {p.completedOrders > 0 && ` · ${t('completed', { count: p.completedOrders })}`}
          </span>
        </span>
        {p.priceFrom && <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold text-text tabular">{p.priceFrom}</span>}
      </div>
    </article>
  );
}
