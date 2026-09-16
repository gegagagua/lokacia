import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, CalendarClock, Globe, MapPin } from 'lucide-react';
import { Avatar, Badge, EmptyState, Stat } from '@lokacia/ui';
import { getAgency, getNames } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
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
  const a = await getAgency(slug);
  if (!a) return { title: (await getTranslations('profiles'))('orgNotFound'), robots: { index: false } };
  const t = await getTranslations('profiles');
  const desc = [a.about, t(`orgType.${a.type}`), t('activeListings', { n: a.stats.active })].filter(Boolean).join(' · ');
  return pageMetadata({ title: `${a.name} — ${t(`orgType.${a.type}`)}`, description: desc, path: `/agency/${a.slug}`, image: a.logoUrl ?? undefined });
}

export default async function AgencyPage({ params }: Props) {
  const { slug } = await params;
  const [a, t, names, f] = await Promise.all([getAgency(slug), getTranslations('profiles'), getNames(), getFormat()]);
  if (!a) notFound();
  const website = a.website ? (a.website.startsWith('http') ? a.website : `https://${a.website}`) : null;
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: a.name, href: `/agency/${a.slug}` }]} className="mb-4" />
      <section className="drawing-grid flex flex-col gap-5 rounded-card border border-border bg-bg p-5 sm:flex-row sm:items-start md:p-8">
        <Avatar src={a.logoUrl} name={a.name} size={96} className="bg-surface" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{t(`orgType.${a.type}`)}</Badge>
            {a.verified && (
              <Badge tone="success" icon={<BadgeCheck className="size-3.5" strokeWidth={1.5} aria-hidden />}>
                {t('verified')}
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-h2 font-semibold md:text-h1">{a.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted">
            {a.rating != null ? (
              <>
                <Stars value={a.rating} label={t('review.stars', { n: a.rating })} />
                <span className="tabular text-text">{a.rating.toFixed(1).replace('.', f.locale === 'en' ? '.' : ',')}</span>
                <span>· {t('reviewsCount', { n: a.reviewsCount })}</span>
              </>
            ) : (
              <span>{t('noRating')}</span>
            )}
            <span>· {t('memberSince', { date: f.date(a.memberSince) })}</span>
          </div>
          {a.about && <p className="mt-3 max-w-2xl">{a.about}</p>}
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
            {a.address && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">{t('address')}: </span>
                {a.address}
              </li>
            )}
            {website && (
              <li className="flex items-center gap-1.5">
                <Globe className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                <a href={website} rel="noopener nofollow" target="_blank" className="text-link hover:underline">
                  {a.website}
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t('stats.active')} value={a.stats.active} />
        <Stat label={t('stats.closed')} value={a.stats.closed} />
        <Stat label={t('team')} value={a.team.length} className="col-span-2 sm:col-span-1" />
      </dl>

      {a.team.length > 0 && (
        <section className="mt-10" aria-labelledby="team">
          <h2 id="team" className="mb-4 text-h3 font-semibold md:text-h2">
            {t('team')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {a.team.map((m) => {
              const inner = (
                <>
                  <Avatar src={m.avatarUrl} name={m.name} size={48} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-small text-muted">
                      {t.has(`roles.${m.role}`) ? t(`roles.${m.role}` as 'roles.agent') : m.role} · {t('activeListings', { n: m.activeListings })}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={m.id}>
                  {m.slug ? (
                    <Link href={`/broker/${m.slug}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 hover:border-border-strong">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {a.projects.length > 0 && (
        <section className="mt-10" aria-labelledby="projects">
          <h2 id="projects" className="mb-4 text-h3 font-semibold md:text-h2">
            {t('projects')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.projects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 hover:border-border-strong">
                  <span className="font-medium">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-small text-muted">
                    <CalendarClock className="size-3.5" strokeWidth={1.5} aria-hidden />
                    {t('completion', { date: f.date(p.completionDate) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="listings">
        <h2 id="listings" className="mb-4 text-h3 font-semibold md:text-h2">
          {t('listings')} <span className="tabular text-muted">({a.stats.active})</span>
        </h2>
        {a.listings.length ? (
          <FavoritesProvider>
            <ListingGrid listings={a.listings} typeNames={names.typeNames} />
          </FavoritesProvider>
        ) : (
          <EmptyState title={t('noListings')} />
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]" aria-labelledby="reviews">
        <div>
          <h2 id="reviews" className="mb-4 text-h3 font-semibold md:text-h2">
            {t('reviews')} <span className="tabular text-muted">({a.reviewsCount})</span>
          </h2>
          <ReviewsList reviews={a.reviews} />
        </div>
        <div className="lg:pt-12">
          <ReviewForm endpoint={`/profiles/agencies/${a.slug}/reviews`} />
        </div>
      </section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'RealEstateAgent',
          name: a.name,
          description: a.about ?? undefined,
          url: absUrl(`/agency/${a.slug}`),
          logo: a.logoUrl ?? undefined,
          ...(a.address ? { address: { '@type': 'PostalAddress', streetAddress: a.address, addressCountry: 'GE' } } : {}),
          ...(website ? { sameAs: [website] } : {}),
          employee: a.team.filter((m) => m.slug).map((m) => ({ '@type': 'Person', name: m.name, url: absUrl(`/broker/${m.slug}`) })),
          ...(a.rating != null && a.reviewsCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: a.rating, reviewCount: a.reviewsCount, bestRating: 5, worstRating: 1 } } : {}),
        }}
      />
    </div>
  );
}
