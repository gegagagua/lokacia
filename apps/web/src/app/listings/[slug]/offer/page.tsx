import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, FileSignature, Lock } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { apiOrNull } from '@/lib/api-server';
import { getBusinessTypes } from '@/lib/taxonomy';
import { requireSession } from '@/components/account/require-session';
import { ListingSummary } from '@/components/account/offers/listing-summary';
import { OfferForm } from '@/components/account/offers/offer-form';
import type { TenantProfileValue } from '@/components/account/offers/tenant-profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('sendOffer'), robots: { index: false, follow: false } };
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireSession(`/listings/${slug}/offer`);
  const t = await getTranslations('offers.new');
  const listing = await apiOrNull<ListingDetail & { canManage?: boolean }>(`/v1/listings/${encodeURIComponent(slug)}?track=0`);
  if (!listing) notFound();
  const [profile, types] = await Promise.all([apiOrNull<TenantProfileValue | null>('/v1/users/me/tenant-profile'), getBusinessTypes().catch(() => [])]);
  const own = listing.canManage || listing.ownerId === user.id;
  const closed = !['active', 'stale'].includes(listing.status);
  const tips = await getTranslations('offers.new.tips');
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(900px_280px_at_70%_0%,color-mix(in_srgb,var(--primary-soft)_85%,transparent),transparent_70%)]" />
      <div className="container-page relative max-w-6xl py-6 sm:py-10">
        <nav className="mb-4 text-small font-medium">
          <Link href={`/listings/${listing.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-muted shadow-xs ring-1 ring-border transition-colors hover:text-text">
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
            {t('back')}
          </Link>
        </nav>
        <div className="mb-6 flex items-start gap-4 sm:mb-8">
          <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-contrast shadow-md sm:grid" aria-hidden>
            <FileSignature className="size-7" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[28px] font-bold leading-9 tracking-tight sm:text-[36px] sm:leading-[44px]">{t('title')}</h1>
            <p className="mt-1.5 max-w-2xl text-[15.5px] text-muted">{t('intro')}</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="order-2 min-w-0 lg:order-1">
            {own || closed ? (
              <div className="card flex items-center gap-4 p-5" role="status">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted" aria-hidden>
                  <Lock className="size-5" strokeWidth={2} />
                </span>
                <p className="font-medium">{own ? t('own') : t('closed')}</p>
              </div>
            ) : (
            <OfferForm
              listing={{ id: listing.id, dealType: listing.dealType, priceMinor: listing.priceMinor, equipment: listing.equipment }}
              profile={profile}
              userName={user.name}
              businessTypes={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa }))}
            />
            )}
          </div>
          <aside className="order-1 flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:order-2">
            <ListingSummary listing={listing} stacked />
            <section className="card hidden p-5 lg:block">
              <h2 className="mb-3 text-[15px] font-bold">{tips('title')}</h2>
              <ol className="flex flex-col gap-3">
                {(['s1', 's2', 's3'] as const).map((k, i) => (
                  <li key={k} className="flex gap-3 text-small">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[12px] font-bold text-primary-soft-text tabular">{i + 1}</span>
                    <span className="text-muted">{tips(k)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
