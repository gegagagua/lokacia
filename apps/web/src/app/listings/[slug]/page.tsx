import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BadgeCheck, Briefcase, Clock, EyeOff, FileText, MapPin, UserRound } from 'lucide-react';
import {
  DEAL_TYPE_LABELS, LISTING_STATUS_LABELS, formatAreaFor, formatMoneyFor, pricePeriodSuffix, relativeDaysFor, type AppLocale, type ListingDetail,
} from '@lokacia/contracts';
import { Badge, VipBadge } from '@lokacia/ui';
import { ListingV2Section } from '@/components/v2/listing-section';
import { getInsights, getListing, getListingPublic, getNames, getSimilar } from '@/components/portal/data';
import { FavoritesProvider } from '@/components/portal/favorites';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { ContactCard, MobileActionBar } from '@/components/portal/listing/contact-card';
import { CostCalculator } from '@/components/portal/listing/cost-calculator';
import { EquipmentTable, HistoryTimeline } from '@/components/portal/listing/equipment-history';
import { ListingGallery } from '@/components/portal/listing/gallery';
import { InsightsPanel } from '@/components/portal/listing/insights-panel';
import { PermitsChecklist } from '@/components/portal/listing/permits';
import { ProjectBlock } from '@/components/portal/listing/prebook';
import { ListingKeyFacts, ListingSpecs } from '@/components/portal/listing/specs';
import { ListingSection } from '@/components/portal/listing/section';
import { SimilarCarousel } from '@/components/portal/listing/similar-carousel';
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

  const facts = [
    l.lastConfirmedAt ? { key: 'confirmed', icon: <Clock className="size-4" strokeWidth={2} aria-hidden />, text: tl('header.confirmed', { when: relativeDaysFor(l.lastConfirmedAt, locale) }), cls: 'text-success' } : null,
    l.isOwner
      ? { key: 'owner', icon: l.verifiedOwner ? <BadgeCheck className="size-4" strokeWidth={2} aria-hidden /> : <UserRound className="size-4" strokeWidth={2} aria-hidden />, text: l.verifiedOwner ? tm('verified') : tl('header.owner'), cls: l.verifiedOwner ? 'text-success' : '' }
      : { key: 'broker', icon: <Briefcase className="size-4" strokeWidth={2} aria-hidden />, text: `${tl('header.broker')} · ${l.commissionPct ? tl('header.commission', { pct: l.commissionPct }) : tl('header.noCommission')}`, cls: '' },
  ].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <FavoritesProvider loggedIn={!!session}>
      <JsonLd data={ld} />
      <div className="container-page pb-32 pt-5 md:pt-6 lg:pb-12">
        <Breadcrumbs items={crumbs} className="mb-5 hidden sm:block" />

        {!isPublic && (
          <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-accent/50 bg-accent-soft px-4 py-3 text-small font-medium">
            <EyeOff className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {tl('header.status', { status: LISTING_STATUS_LABELS[locale][l.status] })} — {tl('header.notPublic')}
          </p>
        )}

        <header className="mb-6 flex flex-col gap-4 md:mb-8">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {l.vip && <VipBadge />}
              <Badge tone={l.dealType === 'transfer' ? 'link' : 'primary'}>{DEAL_TYPE_LABELS[locale][l.dealType]}</Badge>
              {l.businessTypes.map((b) => (
                <Link key={b} href={`/${b}`} className="rounded-full focus-visible:shadow-ring focus-visible:outline-none">
                  <Badge tone="outline" className="transition-colors hover:bg-surface-2 hover:text-text">
                    {typeName(b)}
                  </Badge>
                </Link>
              ))}
              {l.offPlan && <Badge tone="link">{tl('header.offPlan')}</Badge>}
              {l.status !== 'active' && <Badge tone="danger">{LISTING_STATUS_LABELS[locale][l.status]}</Badge>}
            </div>
            <h1 className="max-w-5xl text-[28px] font-bold leading-[1.2] tracking-tight md:text-[38px] md:leading-[1.15] lg:text-h1">{l.title}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted md:text-body">
              <MapPin className="size-[18px] shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
              <span>{l.address}</span>
              {l.districtSlug && l.districtName && (
                <>
                  <span aria-hidden>·</span>
                  <Link href={`/districts/${l.districtSlug}`} className="font-medium text-link hover:underline">
                    {l.districtName}
                  </Link>
                </>
              )}
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-2">
            {l.locationScore != null && (
              <li className="inline-flex h-8 items-center gap-2 rounded-full bg-primary-soft pl-1 pr-3 text-[13px] font-semibold text-primary-soft-text sm:h-9 sm:pr-3.5 sm:text-[14px]">
                <span className="grid size-6 place-items-center rounded-full bg-primary sm:size-7 text-[12.5px] font-bold text-primary-contrast tabular">{l.locationScore}</span>
                {tl('header.score')}
              </li>
            )}
            {facts.map((f) => (
              <li key={f.key} className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-medium shadow-xs sm:h-9 sm:px-3.5 sm:text-[14px] ${f.cls || 'text-text'}`}>
                {f.icon}
                {f.text}
              </li>
            ))}
          </ul>
        </header>

        <ListingGallery media={l.media} title={l.title} videoUrl={l.videoUrl} tourUrl={l.tourUrl} />

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-12">
          <div className="flex min-w-0 flex-col gap-6">
            <ListingKeyFacts listing={l} />
            {l.project && <ProjectBlock listingId={l.id} project={l.project} />}
            <ListingSection id="desc-title" title={tl('description.title')} icon={<FileText className="size-5" strokeWidth={2} />}>
              {l.description ? <p className="max-w-[70ch] whitespace-pre-line text-[16.5px] leading-[1.75]">{l.description}</p> : <p className="text-muted">{tl('description.empty')}</p>}
            </ListingSection>
            <div className="lg:hidden">
              <ContactCard listing={l} />
            </div>
            <ListingSpecs listing={l} />
            {(isLease || calcTypes.length > 0) && <CostCalculator listing={l} types={calcTypes} />}
            {showEquipment && <EquipmentTable listing={l} />}
            {l.lat != null && l.lng != null && (
              <InsightsPanel initial={insights} query={{ lat: l.lat, lng: l.lng, businessType: primaryType, priceMinor: l.priceMinor, areaM2: l.areaM2, dealType: l.dealType }} />
            )}
            {(l.history.length > 0 || l.closuresWarning) && <HistoryTimeline listing={l} typeNames={names.typeNames} />}
            {primaryType && <PermitsChecklist businessType={primaryType} typeName={typeName(primaryType)} />}
          </div>
          <aside className="hidden lg:block" aria-label={tl('contact.title')}>
            <div className="sticky top-24">
              <ContactCard listing={l} />
            </div>
          </aside>
        </div>

        <div className="mt-6">
          <ListingV2Section listing={l} />
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar-title" className="mt-16 flex flex-col gap-6 border-t border-border pt-12 md:mt-20 md:pt-16">
            <div className="flex flex-col gap-2 pr-0 md:pr-28">
              <span className="eyebrow self-start">{tl('similar.eyebrow')}</span>
              <h2 id="similar-title" className="text-[26px] font-bold leading-tight tracking-tight md:text-h2">
                {tl('similar.title')}
              </h2>
              {primaryType && (
                <Link href={`/search?businessType=${primaryType}&dealType=${l.dealType}`} className="inline-flex items-center gap-1 self-start font-semibold text-link hover:underline">
                  {tl('similar.all')}
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </Link>
              )}
            </div>
            <SimilarCarousel listings={similar.slice(0, 9)} typeNames={names.typeNames} labelledBy="similar-title" />
          </section>
        )}
      </div>
      <MobileActionBar listing={l} />
    </FavoritesProvider>
  );
}
