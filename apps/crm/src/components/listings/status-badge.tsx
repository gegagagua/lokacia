import { LISTING_STATUS_LABELS_KA, type ListingStatus } from '@lokacia/contracts';
import { Badge, type BadgeTone } from '@lokacia/ui';

const TONE: Record<ListingStatus, BadgeTone> = {
  draft: 'outline',
  pending_review: 'link',
  active: 'success',
  stale: 'accent',
  rented: 'primary',
  sold: 'primary',
  archived: 'neutral',
  rejected: 'danger',
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge tone={TONE[status]}>{LISTING_STATUS_LABELS_KA[status]}</Badge>;
}
