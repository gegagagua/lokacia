import { Badge, type BadgeTone } from '@lokacia/ui';
import { LISTING_STATUS_LABELS_KA, OFFER_STATUS_LABELS_KA, VIEWING_STATUS_LABELS_KA, type ListingStatus, type OfferStatus } from '@lokacia/contracts';

const LISTING_TONE: Record<ListingStatus, BadgeTone> = {
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
  return <Badge tone={LISTING_TONE[status]}>{LISTING_STATUS_LABELS_KA[status]}</Badge>;
}

const OFFER_TONE: Record<OfferStatus, BadgeTone> = { pending: 'accent', countered: 'link', accepted: 'success', rejected: 'danger', withdrawn: 'neutral' };
export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <Badge tone={OFFER_TONE[status]}>{OFFER_STATUS_LABELS_KA[status]}</Badge>;
}

const VIEWING_TONE = { requested: 'accent', confirmed: 'success', cancelled: 'neutral', done: 'primary' } as const;
export function ViewingStatusBadge({ status }: { status: keyof typeof VIEWING_STATUS_LABELS_KA }) {
  return <Badge tone={VIEWING_TONE[status]}>{VIEWING_STATUS_LABELS_KA[status]}</Badge>;
}
