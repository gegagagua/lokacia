import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, BadgeCheck, MapPin, Phone } from 'lucide-react';
import { Avatar, Badge, Button, SpecRow } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';
import { getProvider } from '@/components/portal/data';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { Stars, categoryName } from '@/components/portal/services/provider-card';

async function getCategoryName() {
  const tc = await getTranslations('services.categories');
  return (slug: string) => (tc.has(slug) ? tc(slug) : categoryName(slug));
}
import { QuoteDialog } from '@/components/portal/services/quote-dialog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProvider(slug);
  if (!p) return { title: (await getTranslations('meta.titles'))('provider'), robots: { index: false } };
  const [catName, f] = await Promise.all([getCategoryName(), getFormat()]);
  const cats = p.categories.map(catName).join(', ');
  return pageMetadata({ title: `${p.name} — ${cats}`, description: p.about ?? `${p.name}: ${cats}, ${f.city(p.city)}.`, path: `/services/${p.slug}`, image: p.portfolio[0] });
}

export default async function ProviderPage({ params }: Props) {
  const { slug } = await params;
  const [p, user] = await Promise.all([getProvider(slug), getSession()]);
  if (!p) notFound();
  const t = await getTranslations('services');
  const hub = await getTranslations('services.hub');
  const [catName, f] = await Promise.all([getCategoryName(), getFormat()]);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: p.name,
    description: p.about ?? undefined,
    url: absUrl(`/services/${p.slug}`),
    image: p.portfolio.map((x) => absUrl(x)),
    areaServed: f.city(p.city),
    address: { '@type': 'PostalAddress', addressLocality: f.city(p.city), addressCountry: 'GE' },
    priceRange: p.priceFrom ?? undefined,
    knowsAbout: p.categories.map(catName),
    ...(p.reviewsCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewsCount, bestRating: 5, worstRating: 1 } } : {}),
    review: p.reviews.slice(0, 5).map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.authorName }, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, reviewBody: r.body ?? undefined, datePublished: r.createdAt.slice(0, 10) })),
  };

  return (
    <div className="container-page py-8">
      <JsonLd data={ld} />
      <Breadcrumbs
        items={[
          { name: 'lokacia.ge', href: '/' },
          { name: hub('providers'), href: '/services' },
          { name: p.name, href: `/services/${p.slug}` },
        ]}
      />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <Avatar src={p.logoUrl} name={p.name} size={72} />
            <div className="min-w-0">
              <h1 className="text-h2 font-semibold md:text-h1">{p.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Stars rating={p.rating} count={p.reviewsCount} />
                {p.verified && (
                  <span className="inline-flex items-center gap-1 text-small text-success">
                    <BadgeCheck className="size-4" strokeWidth={1.5} aria-hidden />
                    {t('provider.verified')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-small text-muted">
                  <MapPin className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {f.city(p.city)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.categories.map((c) => (
                  <Link key={c} href={`/services?category=${c}`}>
                    <Badge tone="primary">{catName(c)}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {p.about && (
            <section className="mt-8">
              <h2 className="text-h3 font-semibold">{t('provider.about')}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{p.about}</p>
            </section>
          )}

          {p.portfolio.length > 0 && (
            <section className="mt-8">
              <h2 className="text-h3 font-semibold">{t('provider.portfolio')}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                {p.portfolio.map((src, i) => (
                  <li key={src} className="overflow-hidden rounded-photo border border-border bg-surface-2">
                    <img src={src} alt={t('provider.portfolioAlt', { name: p.name, n: i + 1 })} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-labelledby="reviews">
            <h2 id="reviews" className="text-h3 font-semibold">
              {t('provider.reviews')} <span className="text-muted tabular">({p.reviewsCount})</span>
            </h2>
            {p.reviews.length === 0 ? (
              <p className="mt-2 text-muted">{t('provider.noReviews')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
                {p.reviews.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{r.authorName}</span>
                      <span className="text-small text-muted">{f.date(r.createdAt)}</span>
                    </div>
                    <Stars rating={r.rating} className="mt-1" />
                    {r.body && <p className="mt-2 leading-relaxed">{r.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
            {p.priceFrom && <SpecRow label={t('provider.priceFrom')} value={p.priceFrom} />}
            <SpecRow label={t('provider.reviews')} value={t('provider.reviewsCount', { count: p.reviewsCount })} />
            <SpecRow label={t('orders.title')} value={t('provider.completed', { count: p.completedOrders })} />
            {p.isMine ? (
              <>
                <p className="text-small text-muted">{t('provider.yours')}</p>
                <Button asChild variant="secondary">
                  <Link href="/account/services?tab=provider">{t('provider.dashboard')}</Link>
                </Button>
              </>
            ) : (
              <QuoteDialog providerId={p.id} providerSlug={p.slug} categories={p.categories} loggedIn={!!user} />
            )}
            <div className="border-t border-border pt-4">
              <p className="text-small text-muted">{t('provider.phone')}</p>
              {p.phone ? (
                <a href={`tel:${p.phone}`} className="mt-1 inline-flex items-center gap-2 font-medium tabular hover:text-link">
                  <Phone className="size-4" strokeWidth={1.5} aria-hidden />
                  {p.phone}
                </a>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/services/${p.slug}`)}`} className="mt-1 inline-block text-link hover:underline">
                  {t('provider.loginForPhone')}
                </Link>
              )}
            </div>
          </div>
          <Button asChild variant="ghost" className="self-start">
            <Link href="/services">
              <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
              {t('provider.back')}
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
