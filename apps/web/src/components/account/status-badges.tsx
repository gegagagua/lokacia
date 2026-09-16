import { Badge, type BadgeTone } from '@lokacia/ui';
import { useTranslations } from 'next-intl';
import type { ListingStatus, OfferStatus, ViewingDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';

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
  const f = useFormat();
  return <Badge tone={LISTING_TONE[status]}>{f.listingStatus(status)}</Badge>;
}

const OFFER_TONE: Record<OfferStatus, BadgeTone> = { pending: 'accent', countered: 'link', accepted: 'success', rejected: 'danger', withdrawn: 'neutral' };
export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const t = useTranslations('offers.status');
  return <Badge tone={OFFER_TONE[status]}>{t(status)}</Badge>;
}

const VIEWING_TONE = { requested: 'accent', confirmed: 'success', cancelled: 'neutral', done: 'primary' } as const;
export function ViewingStatusBadge({ status }: { status: ViewingDto['status'] }) {
  const t = useTranslations('viewings.status');
  return <Badge tone={VIEWING_TONE[status]}>{t(status)}</Badge>;
}
