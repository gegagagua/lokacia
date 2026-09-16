import { LISTING_STATUS_LABELS_KA, type ListingStatus } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { Pill, toneClass, type Tone } from '@/components/common/ui';

export const LISTING_STATUS_TONE: Record<ListingStatus, Tone> = {
  draft: 'neutral',
  pending_review: 2,
  active: 'success',
  stale: 3,
  rented: 4,
  sold: 4,
  archived: 'neutral',
  rejected: 'danger',
};

/** Status pill; `overlay` renders a solid glass pill for use on top of photos. */
export function ListingStatusBadge({ status, overlay }: { status: ListingStatus; overlay?: boolean }) {
  const tone = LISTING_STATUS_TONE[status];
  if (overlay)
    return (
      <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface/95 px-2.5 text-[12.5px] font-semibold text-text shadow-sm backdrop-blur">
        <span aria-hidden className={cn('size-2 rounded-full', tone === 'neutral' ? 'bg-border-strong' : cn('bg-tone', toneClass(tone)))} />
        {LISTING_STATUS_LABELS_KA[status]}
      </span>
    );
  return (
    <Pill tone={tone} dot>
      {LISTING_STATUS_LABELS_KA[status]}
    </Pill>
  );
}
