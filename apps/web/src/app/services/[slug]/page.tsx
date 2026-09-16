import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, BadgeCheck, CheckCircle2, MapPin, MessageSquareQuote, Phone, Star } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';
import { getProvider } from '@/components/portal/data';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { HeroGlow } from '@/components/portal/page-hero';
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
    <>
      <JsonLd data={ld} />
      <section className="relative isolate overflow-hidden border-b border-border bg-surface">
        <HeroGlow />
        <div className="container-page relative pb-10 pt-6 md:pb-12 md:pt-8">
          <Breadcrumbs
            className="mb-6 md:mb-8"
            items={[
              { name: 'lokacia.ge', href: '/' },
              { name: hub('providers'), href: '/services' },
              { name: p.name, href: `/services/${p.slug}` },
            ]}
          />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar src={p.logoUrl} name={p.name} size={96} className="text-[28px] shadow-md ring-4 ring-surface" />
            <div className="min-w-0">
              <p className="eyebrow">{t('provider.eyebrow')}</p>
              <h1 className="mt-3 text-[32px] font-bold leading-[40px] tracking-tight md:text-h1">{p.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Stars rating={p.rating} count={p.reviewsCount} />
                {p.verified && (
                  <Badge tone="success" icon={<BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />}>
                    {t('provider.verified')}
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1 text-[15px] text-muted">
                  <MapPin className="size-4 text-primary-500" strokeWidth={2} aria-hidden />
                  {f.city(p.city)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.categories.map((c) => (
                  <Link key={c} href={`/services?category=${c}`} className="rounded-full transition-transform hover:-translate-y-0.5">
                    <Badge tone="primary">{catName(c)}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-8">
            {p.about && (
              <section className="card p-5 md:p-6">
                <h2 className="text-h3 font-bold">{t('provider.about')}</h2>
                <p className="mt-3 whitespace-pre-line text-[16.5px] leading-relaxed">{p.about}</p>
              </section>
            )}

            {p.portfolio.length > 0 && (
              <section>
                <h2 className="mb-4 text-[24px] font-bold tracking-tight">{t('provider.portfolio')}</h2>
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {p.portfolio.map((src, i) => (
                    <li key={src} className={`group overflow-hidden rounded-photo bg-surface-2 shadow-sm ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                      <img src={src} alt={t('provider.portfolioAlt', { name: p.name, n: i + 1 })} loading="lazy" decoding="async" className="aspect-[4/3] size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="reviews">
              <h2 id="reviews" className="mb-4 text-[24px] font-bold tracking-tight">
                {t('provider.reviews')} <span className="text-muted tabular">({p.reviewsCount})</span>
              </h2>
              {p.reviews.length === 0 ? (
                <EmptyState icon={<MessageSquareQuote className="size-6" strokeWidth={2} aria-hidden />} title={t('provider.noReviews')} />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {p.reviews.map((r) => (
                    <li key={r.id} className="card flex flex-col gap-2 p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.authorName} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{r.authorName}</p>
                          <p className="text-small text-muted">{f.date(r.createdAt)}</p>
                        </div>
                      </div>
                      <Stars rating={r.rating} />
                      {r.body && <p className="leading-relaxed">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card flex flex-col gap-4 p-5 shadow-md md:p-6">
              {p.priceFrom && (
                <div>
                  <p className="text-small text-muted">{t('provider.priceFrom')}</p>
                  <p className="text-[30px] font-bold leading-tight tracking-tight tabular">{p.priceFrom}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
                  <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
                    <Star className="size-3.5" strokeWidth={2} aria-hidden />
                    {t('provider.reviews')}
                  </dt>
                  <dd className="text-[14.5px] font-semibold leading-snug tabular">{t('provider.reviewsCount', { count: p.reviewsCount })}</dd>
                </div>
                <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
                  <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
                    <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden />
                    {t('orders.title')}
                  </dt>
                  <dd className="text-[14.5px] font-semibold leading-snug tabular">{t('provider.completed', { count: p.completedOrders })}</dd>
                </div>
              </dl>
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
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                  <Phone className="size-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-small text-muted">{t('provider.phone')}</p>
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="font-semibold tabular hover:text-link">
                      {p.phone}
                    </a>
                  ) : (
                    <Link href={`/login?next=${encodeURIComponent(`/services/${p.slug}`)}`} className="font-medium text-link hover:underline">
                      {t('provider.loginForPhone')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <Button asChild variant="ghost" className="self-start">
              <Link href="/services">
                <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
                {t('provider.back')}
              </Link>
            </Button>
          </aside>
        </div>
      </div>
    </>
  );
}
