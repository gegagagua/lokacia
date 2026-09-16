import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ListingDetail } from '@lokacia/contracts';
import { apiOrNull } from '@/lib/api-server';
import { getBusinessTypes } from '@/lib/taxonomy';
import { requireSession } from '@/components/account/require-session';
import { ListingSummary } from '@/components/account/offers/listing-summary';
import { OfferForm } from '@/components/account/offers/offer-form';
import type { TenantProfileValue } from '@/components/account/offers/tenant-profile';

export const metadata: Metadata = { title: 'შეთავაზების გაგზავნა', robots: { index: false, follow: false } };

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireSession(`/listings/${slug}/offer`);
  const t = await getTranslations('offers.new');
  const listing = await apiOrNull<ListingDetail & { canManage?: boolean }>(`/v1/listings/${encodeURIComponent(slug)}?track=0`);
  if (!listing) notFound();
  const [profile, types] = await Promise.all([apiOrNull<TenantProfileValue | null>('/v1/users/me/tenant-profile'), getBusinessTypes().catch(() => [])]);
  const own = listing.canManage || listing.ownerId === user.id;
  const closed = !['active', 'stale'].includes(listing.status);
  return (
    <div className="container-page max-w-3xl py-8">
      <nav className="mb-3 text-small">
        <Link href={`/listings/${listing.slug}`} className="text-link underline-offset-4 hover:underline">
          ← {t('back')}
        </Link>
      </nav>
      <h1 className="compact mb-2 text-h2 font-semibold">{t('title')}</h1>
      <p className="mb-6 text-muted">{t('intro')}</p>
      <ListingSummary listing={listing} />
      {own || closed ? (
        <p className="mt-6 rounded-card border border-border bg-surface-2 p-4" role="status">
          {own ? t('own') : t('closed')}
        </p>
      ) : (
        <OfferForm
          listing={{ id: listing.id, dealType: listing.dealType, priceMinor: listing.priceMinor, equipment: listing.equipment }}
          profile={profile}
          userName={user.name}
          businessTypes={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa }))}
        />
      )}
    </div>
  );
}
