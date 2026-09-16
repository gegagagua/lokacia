import Link from '@/i18n/link';
import { MapPin, Ruler } from 'lucide-react';
import type { DealType } from '@lokacia/contracts';
import { PriceTag, cn } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';
import { Thumb } from '../ui';

export type ListingSummaryData = { slug: string; title: string; address: string; cover: string | null; dealType: string; priceMinor: number; currency?: string; pricePeriod: string; areaM2: number };

/** Listing header used on booking/offer pages and threads. `stacked` = vertical card for sidebars. */
export function ListingSummary({ listing, children, stacked }: { listing: ListingSummaryData; children?: React.ReactNode; stacked?: boolean }) {
  const f = useFormat();
  return (
    <div className={cn('card group flex gap-4 overflow-hidden p-3', stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:p-4')}>
      <Thumb src={listing.cover} className={cn('w-full', stacked ? 'aspect-[16/10]' : 'aspect-[16/10] sm:aspect-[4/3] sm:w-40')} />
      <div className={cn('min-w-0 flex-1', stacked && 'px-2')}>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <span className="inline-flex h-7 items-center rounded-full bg-primary-soft px-2.5 text-[12.5px] font-semibold text-primary-soft-text">{f.dealType(listing.dealType as DealType) ?? listing.dealType}</span>
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-[12.5px] font-semibold tabular">
            <Ruler className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
            {f.area(listing.areaM2)}
          </span>
        </div>
        <Link href={`/listings/${listing.slug}`} className="line-clamp-2 text-[18px] font-bold leading-snug tracking-tight hover:text-link">
          {listing.title}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 text-small text-muted">
          <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{listing.address}</span>
        </p>
        <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2', stacked && 'border-t border-border pt-3')}>
          <PriceTag priceMinor={listing.priceMinor} currency={listing.currency} period={listing.pricePeriod as 'month'} areaM2={listing.areaM2} size="sm" locale={f.locale} />
          {children}
        </div>
      </div>
    </div>
  );
}
