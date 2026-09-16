import Link from '@/i18n/link';
import { MapPin } from 'lucide-react';
import type { DealType } from '@lokacia/contracts';
import { Badge, PriceTag } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';

export type ListingSummaryData = { slug: string; title: string; address: string; cover: string | null; dealType: string; priceMinor: number; currency?: string; pricePeriod: string; areaM2: number };

/** Listing header used on booking/offer pages and threads. */
export function ListingSummary({ listing, children }: { listing: ListingSummaryData; children?: React.ReactNode }) {
  const f = useFormat();
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-photo border border-border bg-surface-2 sm:w-40">
        {listing.cover ? <img src={listing.cover} alt="" className="size-full object-cover" /> : <div className="drawing-grid size-full" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <Badge tone="outline">{f.dealType(listing.dealType as DealType) ?? listing.dealType}</Badge>
          <Badge tone="neutral">{f.area(listing.areaM2)}</Badge>
        </div>
        <Link href={`/listings/${listing.slug}`} className="line-clamp-2 text-h3 font-semibold hover:underline">
          {listing.title}
        </Link>
        <p className="mt-1 flex items-center gap-1 text-small text-muted">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="truncate">{listing.address}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <PriceTag priceMinor={listing.priceMinor} currency={listing.currency} period={listing.pricePeriod as 'month'} areaM2={listing.areaM2} size="sm" locale={f.locale} />
        {children}
      </div>
    </div>
  );
}
