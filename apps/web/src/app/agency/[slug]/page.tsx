import { getSession } from '@/lib/session';
import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2, CalendarClock, Globe, Handshake, MapPin, Users } from 'lucide-react';
import { Avatar, Badge, EmptyState } from '@lokacia/ui';
import { getAgency, getNames } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
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
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-surface">
        <HeroGlow />
        <div className="container-page relative pb-10 pt-6 md:pb-12 md:pt-8">
          <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: a.name, href: `/agency/${a.slug}` }]} className="mb-6 md:mb-8" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar src={a.logoUrl} name={a.name} size={112} className="rounded-[28px] shadow-md ring-4 ring-surface" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{t(`orgType.${a.type}`)}</Badge>
                {a.verified && (
                  <Badge tone="success" icon={<BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />}>
                    {t('verified')}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 text-[32px] font-bold leading-[40px] tracking-tight md:text-h1">{a.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted">
                {a.rating != null ? (
                  <>
                    <Stars value={a.rating} label={t('review.stars', { n: a.rating })} />
                    <span className="font-semibold tabular text-text">{a.rating.toFixed(1).replace('.', f.locale === 'en' ? '.' : ',')}</span>
                    <span>· {t('reviewsCount', { n: a.reviewsCount })}</span>
                  </>
                ) : (
                  <span>{t('noRating')}</span>
                )}
                <span>· {t('memberSince', { date: f.date(a.memberSince) })}</span>
              </div>
              {a.about && <p className="mt-3 max-w-2xl text-[16.5px]">{a.about}</p>}
              <ul className="mt-4 flex flex-wrap gap-2 text-[15px]">
                {a.address && (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 shadow-xs ring-1 ring-border">
                    <MapPin className="size-4 text-primary-500" strokeWidth={2} aria-hidden />
                    <span className="sr-only">{t('address')}: </span>
                    {a.address}
                  </li>
                )}
                {website && (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 shadow-xs ring-1 ring-border">
                    <Globe className="size-4 text-link" strokeWidth={2} aria-hidden />
                    <a href={website} rel="noopener nofollow" target="_blank" className="font-medium text-link hover:underline">
                      {a.website}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-10 md:py-12">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={<Building2 className="size-5" strokeWidth={2} aria-hidden />} label={t('stats.active')} value={a.stats.active} />
        <StatTile icon={<Handshake className="size-5" strokeWidth={2} aria-hidden />} label={t('stats.closed')} value={a.stats.closed} tone="accent" />
        <StatTile icon={<Users className="size-5" strokeWidth={2} aria-hidden />} label={t('team')} value={a.team.length} tone="link" />
      </dl>

      {a.team.length > 0 && (
        <section className="mt-12 md:mt-16" aria-labelledby="team">
          <SectionHead id="team" title={t('team')} />
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
                    <Link href={`/broker/${m.slug}`} className="card card-hover flex items-center gap-3 p-4">
                      {inner}
                    </Link>
                  ) : (
                    <div className="card flex items-center gap-3 p-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {a.projects.length > 0 && (
        <section className="mt-12 md:mt-16" aria-labelledby="projects">
          <SectionHead id="projects" title={t('projects')} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.projects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="card card-hover flex items-center gap-3 p-4">
                  <IconTile>
                    <Building2 className="size-5" strokeWidth={2} aria-hidden />
                  </IconTile>
                  <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-small text-muted">
                    <CalendarClock className="size-3.5" strokeWidth={1.5} aria-hidden />
                    {t('completion', { date: f.date(p.completionDate) })}
                  </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 md:mt-16" aria-labelledby="listings">
        <SectionHead
          id="listings"
          title={
            <>
              {t('listings')} <span className="tabular text-muted">({a.stats.active})</span>
            </>
          }
        />
        {a.listings.length ? (
          <FavoritesProvider loggedIn={!!(await getSession())}>
            <ListingGrid listings={a.listings} typeNames={names.typeNames} />
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
                {t('reviews')} <span className="tabular text-muted">({a.reviewsCount})</span>
              </>
            }
          />
          <ReviewsList reviews={a.reviews} />
        </div>
        <div className="lg:pt-[72px]">
          <ReviewForm endpoint={`/profiles/agencies/${a.slug}/reviews`} />
        </div>
      </section>
      </div>

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
    </>
  );
}
