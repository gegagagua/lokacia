import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BellPlus, ClipboardCheck, Map as MapIcon, MessageSquarePlus } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, DEAL_TYPES, PASSPORT_FIELD_BY_KEY, filtersToParams, formatMoney, type LandingDto, type PassportKey } from '@lokacia/contracts';
import { Button, EmptyState } from '@lokacia/ui';
import { absUrl } from '@/lib/site';
import { getSession } from '@/lib/session';
import { getNames, getPermits } from '../data';
import { FavoritesProvider } from '../favorites';
import { ListingGrid } from '../listing-card-link';
import { BusinessTypeIcon } from '../business-type-icon';
import { Breadcrumbs, JsonLd, type Crumb } from '../seo';

/** SEO landing (Phase 14): business type, district, or business type × district — real counts, top listings, internal links, FAQ. */
export async function LandingView({ data, path }: { data: LandingDto; path: string }) {
  const t = await getTranslations('seo');
  const [names, session] = await Promise.all([getNames(), getSession()]);
  const bt = data.businessType ? names.typeBySlug[data.businessType.slug] : null;
  const district = data.district;
  const typeName = data.businessType?.name ?? '';
  const districtName = district?.name ?? '';
  const avg = data.avgPriceM2Minor ? formatMoney(Math.round(data.avgPriceM2Minor / 100) * 100) : null;
  const permits = bt ? await getPermits(bt.slug) : null;

  const h1 = bt && district ? t('landing.h1TypeDistrict', { type: typeName, district: districtName }) : bt ? t('landing.h1Type', { type: typeName }) : t('landing.h1District', { district: districtName });
  const searchFilters = { businessType: bt?.slug, districts: district ? [district.slug] : undefined };
  const searchHref = `/search?${filtersToParams(searchFilters)}`;

  const crumbs: Crumb[] = [{ name: t('home'), href: '/' }];
  if (bt) crumbs.push({ name: typeName, href: `/${bt.slug}` });
  else crumbs.push({ name: t('districts'), href: '/map' });
  if (district) crumbs.push({ name: districtName, href: bt ? `/${bt.slug}/${district.slug}` : `/districts/${district.slug}` });

  const scope = [typeName, districtName].filter(Boolean).join(', ');
  const specs = (bt?.filterConfig.required ?? []).map((k) => PASSPORT_FIELD_BY_KEY[k as PassportKey]?.labelKa).filter(Boolean).join(', ');
  const faq: { q: string; a: string }[] = [
    {
      q: t('landing.faqPriceQ', { scope }),
      a: avg && data.minPriceMinor ? t('landing.faqPriceA', { count: data.total, avg, min: formatMoney(data.minPriceMinor) }) : t('landing.faqPriceNone'),
    },
  ];
  if (bt && specs) faq.push({ q: t('landing.faqSpecsQ', { type: typeName }), a: t('landing.faqSpecsA', { specs }) });
  if (!bt && district && data.related.length) faq.push({ q: t('landing.faqDistrictQ', { district: districtName }), a: t('landing.faqDistrictA', { types: data.related.slice(0, 4).map((r) => `${r.name} (${r.count})`).join(', ') }) });
  faq.push({ q: t('landing.faqOwnersQ'), a: t('landing.faqOwnersA', { share: data.ownersShare }) });
  faq.push({ q: t('landing.faqTrustQ'), a: t('landing.faqTrustA') });

  const stats = [
    { label: t('landing.statTotal'), value: String(data.total) },
    { label: t('landing.statAvg'), value: avg ?? t('landing.noData') },
    { label: t('landing.statMin'), value: data.minPriceMinor ? formatMoney(data.minPriceMinor) : t('landing.noData') },
    { label: t('landing.statArea'), value: data.medianAreaM2 ? `${data.medianAreaM2} მ²` : t('landing.noData') },
    { label: t('landing.statOwners'), value: `${data.ownersShare}%` },
  ];

  // Sibling links: for a type → its districts; for a district → types in it; for a combo → both directions.
  const otherDistricts = bt ? names.districts.filter((d) => d.city === (district?.city ?? 'tbilisi') && d.slug !== district?.slug) : [];
  const otherTypes = district && bt ? names.types.filter((x) => x.slug !== bt.slug) : [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: h1,
          url: absUrl(path),
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: data.total,
            itemListElement: data.listings.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/listings/${l.slug}`), name: l.title })),
          },
        }}
      />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />

      <section className="drawing-grid border-b border-border">
        <div className="container-page py-8 md:py-12">
          <Breadcrumbs items={crumbs} className="mb-5" />
          <div className="flex items-start gap-4">
            {bt && (
              <span className="hidden size-14 shrink-0 place-items-center rounded-card border border-border-strong bg-surface text-primary sm:grid">
                <BusinessTypeIcon name={bt.icon} className="size-7" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-h2 font-semibold md:text-h1">{h1}</h1>
              <p className="mt-2 max-w-2xl text-muted">{t('landing.lead')}</p>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface p-4">
                <dt className="text-small text-muted">{s.label}</dt>
                <dd className="compact mt-1 text-h3 font-semibold tabular">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2" role="list" aria-label={t('landing.dealTypes')}>
            {DEAL_TYPES.filter((d) => data.byDealType[d]).map((d) => (
              <Link
                role="listitem"
                key={d}
                href={`/search?${filtersToParams({ ...searchFilters, dealType: d })}`}
                className="inline-flex h-9 items-center gap-2 rounded-button border border-border-strong bg-surface px-3 text-[15px] hover:bg-surface-2"
              >
                {DEAL_TYPE_LABELS_KA[d]}
                <span className="text-small text-muted tabular">{data.byDealType[d]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container-page py-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-h3 font-semibold md:text-h2">{t('landing.top')}</h2>
          {data.total > 0 && (
            <Button asChild variant="secondary">
              <Link href={searchHref}>
                {t('landing.seeAll', { count: data.total })}
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          )}
        </div>
        {data.listings.length ? (
          <FavoritesProvider loggedIn={!!session}>
            <ListingGrid listings={data.listings} typeNames={names.typeNames} priorityCount={0} />
          </FavoritesProvider>
        ) : (
          <EmptyState
            title={t('landing.empty')}
            description={t('landing.emptyHint')}
            action={
              <Button asChild>
                <Link href={searchHref}>
                  <BellPlus className="size-4" strokeWidth={1.5} aria-hidden />
                  {t('landing.saveSearch')}
                </Link>
              </Button>
            }
          />
        )}
      </div>

      <div className="container-page grid gap-8 pb-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {data.related.length > 0 && (
            <section aria-labelledby="related-h" className="mb-10">
              <h2 id="related-h" className="mb-3 text-h3 font-semibold">
                {bt && !district ? t('landing.byDistrict', { type: typeName }) : t('landing.byType', { district: districtName })}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {data.related.map((r) => {
                  const href = r.kind === 'district' ? `/${bt!.slug}/${r.slug}` : district ? `/${r.slug}/${district.slug}` : `/${r.slug}`;
                  return (
                    <li key={`${r.kind}-${r.slug}`}>
                      <Link href={href} className="flex items-center justify-between gap-2 rounded-button border border-border bg-surface px-3 py-2 hover:border-border-strong">
                        <span className="truncate">{r.name}</span>
                        <span className="text-small text-muted tabular">{r.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="faq-h" className="mb-10">
            <h2 id="faq-h" className="mb-3 text-h3 font-semibold">
              {t('landing.faq')}
            </h2>
            <div className="divide-y divide-border rounded-card border border-border bg-surface">
              {faq.map((f, i) => (
                <details key={f.q} className="group px-4 py-3" open={i === 0}>
                  <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {f.q}
                      <span aria-hidden className="text-muted transition-transform duration-150 group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {(otherDistricts.length > 0 || otherTypes.length > 0) && (
            <nav aria-label={otherTypes.length ? t('landing.otherTypes') : t('landing.otherDistricts')} className="mb-10 text-small">
              {otherTypes.length > 0 && (
                <>
                  <h2 className="mb-2 font-semibold uppercase tracking-wide text-muted">{t('landing.otherTypes')}</h2>
                  <p className="flex flex-wrap gap-x-3 gap-y-1">
                    {otherTypes.map((x) => (
                      <Link key={x.slug} href={`/${x.slug}/${district!.slug}`} className="text-link hover:underline">
                        {x.nameKa}
                      </Link>
                    ))}
                  </p>
                </>
              )}
              {bt && district && otherDistricts.length > 0 && (
                <>
                  <h2 className="mb-2 mt-4 font-semibold uppercase tracking-wide text-muted">{t('landing.otherDistricts')}</h2>
                  <p className="flex flex-wrap gap-x-3 gap-y-1">
                    {otherDistricts.map((d) => (
                      <Link key={d.slug} href={`/${bt.slug}/${d.slug}`} className="text-link hover:underline">
                        {d.nameKa}
                      </Link>
                    ))}
                  </p>
                </>
              )}
            </nav>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {permits && bt && (
            <div className="rounded-card border border-border bg-surface p-5">
              <ClipboardCheck className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
              <h2 className="mt-3 text-h3 font-semibold">{t('landing.permits')}</h2>
              <p className="mt-1 text-small text-muted">{t('landing.permitsLead')}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-link">{t('landing.permitsOpen')}</summary>
                <PermitsBody md={permits.bodyMd} />
              </details>
            </div>
          )}
          <div className="rounded-card border border-border bg-surface p-5">
            <MessageSquarePlus className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-h3 font-semibold">{t('landing.demandTitle')}</h2>
            <p className="mt-1 text-small text-muted">{t('landing.demandLead')}</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/demand/new">{t('landing.demandCta')}</Link>
            </Button>
          </div>
          <Link href={`/map${bt ? `?businessType=${bt.slug}` : ''}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-border-strong">
            <MapIcon className="size-5 text-link" strokeWidth={1.5} aria-hidden />
            <span className="font-medium">{t('landing.mapCta')}</span>
            <ArrowRight className="ml-auto size-4 text-muted" strokeWidth={1.5} aria-hidden />
          </Link>
        </aside>
      </div>
    </>
  );
}

async function PermitsBody({ md }: { md: string }) {
  const [{ default: Markdown }, { default: gfm }] = await Promise.all([import('react-markdown'), import('remark-gfm')]);
  return (
    <div className="prose-ka mt-3 text-small">
      <Markdown remarkPlugins={[gfm]}>{md.replace(/^# .*\n/, '')}</Markdown>
    </div>
  );
}
