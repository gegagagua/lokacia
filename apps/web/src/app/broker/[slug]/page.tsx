import { getSession } from '@/lib/session';
import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2, Handshake, MapPin } from 'lucide-react';
import { Avatar, EmptyState } from '@lokacia/ui';
import { getBroker, getNames } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
import { RevealPhone } from '@/components/portal/profiles/reveal-phone';
import { ReviewForm } from '@/components/portal/profiles/review-form';
import { ReviewsList } from '@/components/portal/profiles/reviews';
import { Stars } from '@/components/portal/profiles/stars';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { HeroGlow, IconTile, SectionHead, StatTile } from '@/components/portal/page-hero';
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
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-surface">
        <HeroGlow />
        <div className="container-page relative pb-10 pt-6 md:pb-12 md:pt-8">
          <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('brokersTitle'), href: '/brokers' }, { name: b.name, href: `/broker/${b.slug}` }]} className="mb-6 md:mb-8" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar src={b.avatarUrl} name={b.name} size={112} className="shadow-md ring-4 ring-surface" />
              <div className="min-w-0">
                <h1 className="text-[32px] font-bold leading-[40px] tracking-tight md:text-h1">{b.name}</h1>
                {b.org && (
                  <Link href={`/agency/${b.org.slug}`} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[15px] font-medium text-link shadow-xs ring-1 ring-border hover:underline">
                    <Building2 className="size-4" strokeWidth={2} aria-hidden />
                    {b.org.name}
                    {b.org.verified && <BadgeCheck className="size-4 text-success" strokeWidth={2} aria-label={t('verified')} />}
                  </Link>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-muted">
                  {b.rating != null ? (
                    <>
                      <Stars value={b.rating} label={t('review.stars', { n: b.rating })} />
                      <span className="font-semibold tabular text-text">{b.rating.toFixed(1).replace('.', f.locale === 'en' ? '.' : ',')}</span>
                      <span>· {t('reviewsCount', { n: b.reviewsCount })}</span>
                    </>
                  ) : (
                    <span>{t('noRating')}</span>
                  )}
                  <span>· {t('memberSince', { date: f.date(b.memberSince) })}</span>
                </div>
                {b.bio && <p className="mt-3 max-w-2xl text-[16.5px]">{b.bio}</p>}
              </div>
            </div>
            <div className="card p-4 shadow-md">
              <RevealPhone slug={b.slug} />
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-10 md:py-12">
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={<Building2 className="size-5" strokeWidth={2} aria-hidden />} label={t('stats.active')} value={b.stats.active} />
        <StatTile icon={<Handshake className="size-5" strokeWidth={2} aria-hidden />} label={t('stats.closed')} value={b.stats.closed} tone="accent" />
        <div className="card flex items-start gap-3 p-5">
          <IconTile tone="link">
            <MapPin className="size-5" strokeWidth={2} aria-hidden />
          </IconTile>
          <div className="min-w-0">
            <dt className="text-small text-muted">{t('stats.districts')}</dt>
            <dd className="mt-1 text-[15px] font-medium leading-snug">{b.stats.districts.length ? b.stats.districts.join(', ') : '—'}</dd>
          </div>
        </div>
      </dl>

      <section className="mt-12 md:mt-16" aria-labelledby="listings">
        <SectionHead
          id="listings"
          title={
            <>
              {t('listings')} <span className="tabular text-muted">({b.stats.active})</span>
            </>
          }
        />
        {b.listings.length ? (
          <FavoritesProvider loggedIn={!!(await getSession())}>
            <ListingGrid listings={b.listings} typeNames={names.typeNames} priorityCount={0} />
          </FavoritesProvider>
        ) : (
          <EmptyState title={t('noListings')} />
        )}
      </section>

      <section className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1.5fr_1fr]" aria-labelledby="reviews">
        <div>
          <SectionHead
            id="reviews"
            title={
              <>
                {t('reviews')} <span className="tabular text-muted">({b.reviewsCount})</span>
              </>
            }
          />
          <ReviewsList reviews={b.reviews} />
        </div>
        <div className="lg:pt-[72px]">
          <ReviewForm endpoint={`/profiles/brokers/${b.slug}/reviews`} />
        </div>
      </section>
      </div>

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
    </>
  );
}
