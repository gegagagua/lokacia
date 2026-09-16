import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2 } from 'lucide-react';
import { Avatar, EmptyState, Stat } from '@lokacia/ui';
import { getBroker, getNames } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
import { RevealPhone } from '@/components/portal/profiles/reveal-phone';
import { ReviewForm } from '@/components/portal/profiles/review-form';
import { ReviewsList } from '@/components/portal/profiles/reviews';
import { Stars } from '@/components/portal/profiles/stars';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBroker(slug);
  if (!b) return { title: (await getTranslations('profiles'))('brokerNotFound'), robots: { index: false } };
  const t = await getTranslations('profiles');
  const desc = [b.bio, b.org?.name, t('activeListings', { n: b.stats.active }), b.stats.districts.slice(0, 4).join(', ')].filter(Boolean).join(' · ');
  return { ...(await pageMetadata({ title: `${b.name} — ${t('brokersTitle')}`, description: desc, path: `/broker/${b.slug}`, type: 'article' })), ...(b.avatarUrl ? {} : {}) };
}

export default async function BrokerPage({ params }: Props) {
  const { slug } = await params;
  const [b, t, names, f] = await Promise.all([getBroker(slug), getTranslations('profiles'), getNames(), getFormat()]);
  if (!b) notFound();
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('brokersTitle'), href: '/brokers' }, { name: b.name, href: `/broker/${b.slug}` }]} className="mb-4" />
      <section className="drawing-grid grid gap-6 rounded-card border border-border bg-bg p-5 md:grid-cols-[1fr_auto] md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar src={b.avatarUrl} name={b.name} size={96} className="bg-surface" />
          <div className="min-w-0">
            <h1 className="text-h2 font-semibold md:text-h1">{b.name}</h1>
            {b.org && (
              <Link href={`/agency/${b.org.slug}`} className="mt-1 inline-flex items-center gap-1.5 text-link hover:underline">
                <Building2 className="size-4" strokeWidth={1.5} aria-hidden />
                {b.org.name}
                {b.org.verified && <BadgeCheck className="size-4 text-success" strokeWidth={1.5} aria-label={t('verified')} />}
              </Link>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted">
              {b.rating != null ? (
                <>
                  <Stars value={b.rating} label={t('review.stars', { n: b.rating })} />
                  <span className="tabular text-text">{b.rating.toFixed(1).replace('.', f.locale === 'en' ? '.' : ',')}</span>
                  <span>· {t('reviewsCount', { n: b.reviewsCount })}</span>
                </>
              ) : (
                <span>{t('noRating')}</span>
              )}
              <span>· {t('memberSince', { date: f.date(b.memberSince) })}</span>
            </div>
            {b.bio && <p className="mt-3 max-w-2xl">{b.bio}</p>}
          </div>
        </div>
        <div className="md:w-64">
          <RevealPhone slug={b.slug} />
        </div>
      </section>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t('stats.active')} value={b.stats.active} />
        <Stat label={t('stats.closed')} value={b.stats.closed} />
        <div className="rounded-card border border-border bg-surface p-4">
          <dt className="text-small text-muted">{t('stats.districts')}</dt>
          <dd className="mt-1 text-[15px]">{b.stats.districts.length ? b.stats.districts.join(', ') : '—'}</dd>
        </div>
      </dl>

      <section className="mt-10" aria-labelledby="listings">
        <h2 id="listings" className="mb-4 text-h3 font-semibold md:text-h2">
          {t('listings')} <span className="tabular text-muted">({b.stats.active})</span>
        </h2>
        {b.listings.length ? (
          <FavoritesProvider>
            <ListingGrid listings={b.listings} typeNames={names.typeNames} priorityCount={0} />
          </FavoritesProvider>
        ) : (
          <EmptyState title={t('noListings')} />
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]" aria-labelledby="reviews">
        <div>
          <h2 id="reviews" className="mb-4 text-h3 font-semibold md:text-h2">
            {t('reviews')} <span className="tabular text-muted">({b.reviewsCount})</span>
          </h2>
          <ReviewsList reviews={b.reviews} />
        </div>
        <div className="lg:pt-12">
          <ReviewForm endpoint={`/profiles/brokers/${b.slug}/reviews`} />
        </div>
      </section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': ['Person', 'RealEstateAgent'],
          name: b.name,
          description: b.bio ?? undefined,
          url: absUrl(`/broker/${b.slug}`),
          image: b.avatarUrl ?? undefined,
          ...(b.org ? { worksFor: { '@type': 'RealEstateAgent', name: b.org.name, url: absUrl(`/agency/${b.org.slug}`) } } : {}),
          ...(b.rating != null && b.reviewsCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviewsCount, bestRating: 5, worstRating: 1 } } : {}),
        }}
      />
    </div>
  );
}
