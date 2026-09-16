import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Clock, MapPin } from 'lucide-react';
import {
  DEAL_TYPE_LABELS, LISTING_STATUS_LABELS, formatAreaFor, formatMoneyFor, pricePeriodSuffix, relativeDaysFor, type AppLocale, type ListingDetail,
} from '@lokacia/contracts';
import { Badge, PriceTag, VerifiedBadge, VipBadge } from '@lokacia/ui';
import { ListingV2Section } from '@/components/v2/listing-section';
import { getInsights, getListing, getListingPublic, getNames, getSimilar } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { ContactCard, MobileActionBar } from '@/components/portal/listing/contact-card';
import { CostCalculator } from '@/components/portal/listing/cost-calculator';
import { EquipmentTable, HistoryTimeline } from '@/components/portal/listing/equipment-history';
import { ListingGallery } from '@/components/portal/listing/gallery';
import { InsightsPanel } from '@/components/portal/listing/insights-panel';
import { PermitsChecklist } from '@/components/portal/listing/permits';
import { ProjectBlock } from '@/components/portal/listing/prebook';
import { ListingSpecs } from '@/components/portal/listing/specs';
import { getSession } from '@/lib/session';
import { absUrl, cityName } from '@/lib/site';
import { localizeListing } from '@/i18n/content';
import { localizePath } from '@/i18n/locale';
import { getAppLocale } from '@/i18n/server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [raw, locale, tm] = await Promise.all([getListingPublic(slug), getAppLocale(), getTranslations('meta')]);
  if (!raw) return { title: tm('titles.listingNotFound'), robots: { index: false } };
  const l = localizeListing(raw, locale);
  const price = `${formatMoneyFor(l.priceMinor, locale, l.currency)}${pricePeriodSuffix(l.pricePeriod, locale)}`;
  const title = `${l.title} — ${formatAreaFor(l.areaM2, locale)}, ${price}`;
  const specs = [
    l.districtName,
    formatAreaFor(l.areaM2, locale),
    l.passport.ceilingM ? tm('listing.ceiling', { value: l.passport.ceilingM }) : null,
    l.passport.powerKw ? tm('listing.power', { value: l.passport.powerKw }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const description = `${DEAL_TYPE_LABELS[locale][l.dealType]}: ${specs}. ${l.description}`.slice(0, 200).trim();
  const indexable = l.status === 'active' || l.status === 'stale';
  // same slug in every language: /listings/<slug>, /en/listings/<slug>, /ru/listings/<slug>
  return pageMetadata({ title, description, path: `/listings/${l.slug}`, type: 'article', noindex: !indexable, locale });
}

function listingJsonLd(l: ListingDetail, locale: AppLocale) {
  const url = absUrl(localizePath(`/listings/${l.slug}`, locale));
  const images = l.media.filter((m) => m.kind === 'photo').map((m) => absUrl(m.variants?.lg ?? m.url));
  const available = l.status === 'active' || l.status === 'stale';
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    url,
    inLanguage: locale,
    name: l.title,
    description: l.description,
    datePosted: l.publishedAt ?? l.createdAt,
    dateModified: l.updatedAt,
    image: images,
    offers: {
      '@type': 'Offer',
      price: l.priceMinor / 100,
      priceCurrency: l.currency,
      businessFunction: l.dealType === 'sale' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      ...(l.pricePeriod === 'month' ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: l.priceMinor / 100, priceCurrency: l.currency, unitCode: 'MON' } } : {}),
      seller: { '@type': l.contact.orgName ? 'Organization' : 'Person', name: l.contact.orgName ?? l.contact.name },
    },
    contentLocation: {
      '@type': 'Place',
      name: l.address,
      address: { '@type': 'PostalAddress', streetAddress: l.address, addressRegion: l.districtName ?? undefined, addressCountry: 'GE' },
      ...(l.lat != null && l.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}),
    },
    floorSize: { '@type': 'QuantitativeValue', value: l.areaM2, unitCode: 'MTK' },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const [raw, names, session, tl, tm, locale] = await Promise.all([getListing(slug), getNames(), getSession(), getTranslations('listing'), getTranslations('meta.listing'), getAppLocale()]);
  if (!raw) notFound();
  const l = localizeListing(raw, locale);

  const primaryType = l.businessTypes[0];
  const typeName = (s: string) => names.typeNames[s] ?? s;
  const isLease = l.dealType === 'rent' || l.dealType === 'short_term';
  const insightsQs = new URLSearchParams({
    lat: String(l.lat ?? ''),
    lng: String(l.lng ?? ''),
    radiusM: '500',
    priceMinor: String(l.priceMinor),
    areaM2: String(l.areaM2),
    dealType: l.dealType,
    ...(primaryType ? { businessType: primaryType } : {}),
  });
  const [insights, similar] = await Promise.all([l.lat != null && l.lng != null ? getInsights(insightsQs.toString()) : Promise.resolve(null), getSimilar(l.id)]);
  const calcTypes = l.businessTypes
    .map((s) => names.typeBySlug[s])
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ slug: x.slug, nameKa: x.nameKa, utilityCoef: Number(x.utilityCoef), fitoutPerM2Minor: x.fitoutPerM2Minor }));
  // city from district (for address locality)
  const district = l.districtSlug ? names.districtBySlug[l.districtSlug] : null;
  const city = district ? cityName(district.city, locale) : null;
  const crumbs = [
    { name: tl('breadcrumbs.home'), href: '/' },
    ...(primaryType ? [{ name: typeName(primaryType), href: `/${primaryType}` }] : []),
    ...(primaryType && l.districtSlug && l.districtName ? [{ name: l.districtName, href: `/${primaryType}/${l.districtSlug}` }] : []),
    { name: l.title, href: `/listings/${l.slug}` },
  ];
  const ld = listingJsonLd(l, locale);
  if (city) (ld.contentLocation.address as Record<string, unknown>).addressLocality = city;
  const isPublic = l.status === 'active' || l.status === 'stale';
  const showEquipment = l.dealType === 'transfer' || l.equipment.length > 0;
  const perM2 = l.pricePeriod === 'month' || l.pricePeriod === 'total' ? Math.round(l.priceMinor / l.areaM2) : null;

  return (
    <FavoritesProvider loggedIn={!!session}>
      <JsonLd data={ld} />
      <div className="container-page pb-28 pt-6 lg:pb-12">
        <Breadcrumbs items={crumbs} className="mb-4" />

        {!isPublic && (
          <p role="status" className="mb-4 rounded-card border border-accent bg-accent/10 px-4 py-3 text-small">
            {tl('header.status', { status: LISTING_STATUS_LABELS[locale][l.status] })} — {tl('header.notPublic')}
          </p>
        )}

        <header className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {l.vip && <VipBadge />}
            <Badge tone={l.dealType === 'transfer' ? 'link' : 'outline'}>{DEAL_TYPE_LABELS[locale][l.dealType]}</Badge>
            {l.businessTypes.map((b) => (
              <Link key={b} href={`/${b}`}>
                <Badge tone="neutral" className="hover:border-border-strong">
                  {typeName(b)}
                </Badge>
              </Link>
            ))}
            {l.offPlan && <Badge tone="primary">{tl('header.offPlan')}</Badge>}
            {l.status !== 'active' && <Badge tone="danger">{LISTING_STATUS_LABELS[locale][l.status]}</Badge>}
          </div>
          <h1 className="text-h2 font-semibold md:text-h1">{l.title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
            <MapPin className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span>{l.address}</span>
            {l.districtSlug && l.districtName && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/districts/${l.districtSlug}`} className="text-link hover:underline">
                  {l.districtName}
                </Link>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-end gap-6">
              <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} size="lg" locale={locale} />
              <div className="flex flex-col text-small text-muted">
                <span className="compact text-h3 font-semibold text-text tabular">{formatAreaFor(l.areaM2, locale)}</span>
                {perM2 !== null && <span className="tabular">{tl('header.perM2', { price: formatMoneyFor(perM2, locale, l.currency) })}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-small">
              {l.isOwner ? (
                l.verifiedOwner ? (
                  <VerifiedBadge />
                ) : (
                  <Badge tone="primary">{tl('header.owner')}</Badge>
                )
              ) : (
                <Badge tone="outline">
                  {tl('header.broker')} · {l.commissionPct ? tl('header.commission', { pct: l.commissionPct }) : tl('header.noCommission')}
                </Badge>
              )}
              {l.lastConfirmedAt && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Clock className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {tl('header.confirmed', { when: relativeDaysFor(l.lastConfirmedAt, locale) })}
                </span>
              )}
              {!l.isOwner && l.verifiedOwner && <BadgeCheck className="size-4 text-success" strokeWidth={1.5} aria-label={tm('verified')} />}
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-10">
            <ListingGallery media={l.media} title={l.title} videoUrl={l.videoUrl} tourUrl={l.tourUrl} />
            {l.project && <ProjectBlock listingId={l.id} project={l.project} />}
            <ListingSpecs listing={l} />
            <section aria-labelledby="desc-title" className="flex flex-col gap-2">
              <h2 id="desc-title" className="text-h3 font-semibold">
                {tl('description.title')}
              </h2>
              {l.description ? <p className="max-w-[72ch] whitespace-pre-line leading-relaxed">{l.description}</p> : <p className="text-muted">{tl('description.empty')}</p>}
            </section>
            {(isLease || calcTypes.length > 0) && <CostCalculator listing={l} types={calcTypes} />}
            {showEquipment && <EquipmentTable listing={l} />}
            {(l.history.length > 0 || l.closuresWarning) && <HistoryTimeline listing={l} typeNames={names.typeNames} />}
            {l.lat != null && l.lng != null && (
              <InsightsPanel initial={insights} query={{ lat: l.lat, lng: l.lng, businessType: primaryType, priceMinor: l.priceMinor, areaM2: l.areaM2, dealType: l.dealType }} />
            )}
            {primaryType && <PermitsChecklist businessType={primaryType} typeName={typeName(primaryType)} />}
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <ContactCard listing={l} />
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar-title" className="mt-12 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 id="similar-title" className="text-h3 font-semibold md:text-h2">
                {tl('similar.title')}
              </h2>
              {primaryType && (
                <Link href={`/search?businessType=${primaryType}&dealType=${l.dealType}`} className="text-small text-link hover:underline">
                  {tl('similar.all')}
                </Link>
              )}
            </div>
            <ListingGrid listings={similar.slice(0, 6)} typeNames={names.typeNames} />
          </section>
        )}

        <div className="lg:hidden mt-10">
          <ContactCard listing={l} />
        </div>

        <ListingV2Section listing={l} />
      </div>
      <MobileActionBar listing={l} />
    </FavoritesProvider>
  );
}
