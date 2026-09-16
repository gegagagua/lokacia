import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BellPlus, Building2, ChevronDown, ClipboardCheck, Coins, Map as MapIcon, MapPin, MessageSquarePlus, Plus, Ruler, TrendingDown, UserCheck } from 'lucide-react';
import { DEAL_TYPES, PASSPORT_FIELD_BY_KEY, filtersToParams, type LandingDto, type PassportKey } from '@lokacia/contracts';
import { Button, EmptyState } from '@lokacia/ui';
import { absUrl } from '@/lib/site';
import { getSession } from '@/lib/session';
import { getFormat } from '@/i18n/server';
import { getNames, getPermits } from '../data';
import { FavoritesProvider } from '../favorites';
import { ListingGrid } from '../listing-card-link';
import { BusinessTypeIcon } from '../business-type-icon';
import { JsonLd, type Crumb } from '../seo';
import { HeroStat, PageHero, SectionHead } from '../page-hero';

const STAT_ICONS = [Building2, Coins, TrendingDown, Ruler, UserCheck];

/** SEO landing (Phase 14): business type, district, or business type × district — real counts, top listings, internal links, FAQ. */
export async function LandingView({ data, path }: { data: LandingDto; path: string }) {
  const t = await getTranslations('seo');
  const [names, session, fmt] = await Promise.all([getNames(), getSession(), getFormat()]);
  const bt = data.businessType ? names.typeBySlug[data.businessType.slug] : null;
  const district = data.district;
  // API names are Georgian — use the localized taxonomy names (fallback: API value).
  const typeName = data.businessType ? (names.typeNames[data.businessType.slug] ?? data.businessType.name) : '';
  const districtName = district ? (names.districtNames[district.slug] ?? district.name) : '';
  const relatedName = (r: LandingDto['related'][number]) => (r.kind === 'district' ? names.districtNames[r.slug] : names.typeNames[r.slug]) ?? r.name;
  const avg = data.avgPriceM2Minor ? fmt.money(Math.round(data.avgPriceM2Minor / 100) * 100) : null;
  const permits = bt ? await getPermits(bt.slug) : null;

  const h1 = bt && district ? t('landing.h1TypeDistrict', { type: typeName, district: districtName }) : bt ? t('landing.h1Type', { type: typeName }) : t('landing.h1District', { district: districtName });
  const searchFilters = { businessType: bt?.slug, districts: district ? [district.slug] : undefined };
  const searchHref = `/search?${filtersToParams(searchFilters)}`;

  const crumbs: Crumb[] = [{ name: t('home'), href: '/' }];
  if (bt) crumbs.push({ name: typeName, href: `/${bt.slug}` });
  else crumbs.push({ name: t('districts'), href: '/map' });
  if (district) crumbs.push({ name: districtName, href: bt ? `/${bt.slug}/${district.slug}` : `/districts/${district.slug}` });

  const scope = [typeName, districtName].filter(Boolean).join(', ');
  const specs = (bt?.filterConfig.required ?? []).filter((k) => PASSPORT_FIELD_BY_KEY[k as PassportKey]).map((k) => fmt.passport(k as PassportKey)).join(', ');
  const faq: { q: string; a: string }[] = [
    {
      q: t('landing.faqPriceQ', { scope }),
      a: avg && data.minPriceMinor ? t('landing.faqPriceA', { count: data.total, avg, min: fmt.money(data.minPriceMinor) }) : t('landing.faqPriceNone'),
    },
  ];
  if (bt && specs) faq.push({ q: t('landing.faqSpecsQ', { type: typeName }), a: t('landing.faqSpecsA', { specs }) });
  if (!bt && district && data.related.length) faq.push({ q: t('landing.faqDistrictQ', { district: districtName }), a: t('landing.faqDistrictA', { types: data.related.slice(0, 4).map((r) => `${relatedName(r)} (${r.count})`).join(', ') }) });
  faq.push({ q: t('landing.faqOwnersQ'), a: t('landing.faqOwnersA', { share: data.ownersShare }) });
  faq.push({ q: t('landing.faqTrustQ'), a: t('landing.faqTrustA') });

  const stats = [
    { label: t('landing.statTotal'), value: String(data.total) },
    { label: t('landing.statAvg'), value: avg ?? t('landing.noData') },
    { label: t('landing.statMin'), value: data.minPriceMinor ? fmt.money(data.minPriceMinor) : t('landing.noData') },
    { label: t('landing.statArea'), value: data.medianAreaM2 ? `${data.medianAreaM2} ${fmt.areaUnit}` : t('landing.noData') },
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

      <PageHero
        crumbs={crumbs}
        eyebrow={bt ? typeName : t('districts')}
        eyebrowIcon={bt ? <BusinessTypeIcon name={bt.icon} className="size-3.5" /> : <MapPin className="size-3.5" strokeWidth={2} aria-hidden />}
        title={h1}
        lead={t('landing.lead')}
        actions={
          <>
            {data.total > 0 && (
              <Button asChild size="lg">
                <Link href={searchHref}>
                  {t('landing.seeAll', { count: data.total })}
                  <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link href={`/map${bt ? `?businessType=${bt.slug}` : ''}`}>
                <MapIcon className="size-4" strokeWidth={2} aria-hidden />
                {t('landing.mapCta')}
              </Link>
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => {
            const Icon = STAT_ICONS[i] ?? Building2;
            return <HeroStat key={s.label} label={s.label} value={s.value} icon={<Icon className="size-4" strokeWidth={2} aria-hidden />} />;
          })}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-2" role="list" aria-label={t('landing.dealTypes')}>
          {DEAL_TYPES.filter((d) => data.byDealType[d]).map((d) => (
            <Link
              role="listitem"
              key={d}
              href={`/search?${filtersToParams({ ...searchFilters, dealType: d })}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-1.5 text-[15px] font-medium shadow-xs transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
            >
              {fmt.dealType(d)}
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary-soft px-2 text-small font-semibold text-primary-soft-text tabular">{data.byDealType[d]}</span>
            </Link>
          ))}
        </div>
      </PageHero>

      <section className="container-page py-12 md:py-16" aria-labelledby="top-h">
        <SectionHead id="top-h" title={t('landing.top')} />
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
                  <BellPlus className="size-4" strokeWidth={2} aria-hidden />
                  {t('landing.saveSearch')}
                </Link>
              </Button>
            }
          />
        )}
      </section>

      <div className="container-page grid gap-10 pb-16 md:pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {data.related.length > 0 && (
            <section aria-labelledby="related-h" className="mb-12">
              <SectionHead id="related-h" title={bt && !district ? t('landing.byDistrict', { type: typeName }) : t('landing.byType', { district: districtName })} className="mb-5" />
              <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {data.related.map((r) => {
                  const href = r.kind === 'district' ? `/${bt!.slug}/${r.slug}` : district ? `/${r.slug}/${district.slug}` : `/${r.slug}`;
                  const icon = r.kind === 'district' ? null : names.typeBySlug[r.slug]?.icon;
                  return (
                    <li key={`${r.kind}-${r.slug}`}>
                      <Link href={href} className="card card-hover group flex items-center gap-3 p-3 pr-4">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                          {icon ? <BusinessTypeIcon name={icon} className="size-[18px]" /> : <MapPin className="size-[18px]" strokeWidth={2} aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{relatedName(r)}</span>
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-small font-semibold text-muted tabular">{r.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="faq-h" className="mb-12">
            <SectionHead id="faq-h" title={t('landing.faq')} className="mb-5" />
            <div className="flex flex-col gap-3">
              {faq.map((f, i) => (
                <details key={f.q} className="card group p-0 open:shadow-md" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-[16.5px] font-semibold marker:hidden focus-visible:shadow-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition-transform duration-200 group-open:rotate-45 group-open:bg-primary-soft group-open:text-primary-soft-text">
                      <Plus className="size-4" strokeWidth={2.25} />
                    </span>
                  </summary>
                  <p className="-mt-1 px-5 pb-5 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {(otherTypes.length > 0 || (bt && district && otherDistricts.length > 0)) && (
            <nav aria-label={otherTypes.length ? t('landing.otherTypes') : t('landing.otherDistricts')} className="card p-5 md:p-6">
              {otherTypes.length > 0 && (
                <>
                  <h2 className="mb-3 text-small font-semibold text-muted">{t('landing.otherTypes')}</h2>
                  <p className="flex flex-wrap gap-2">
                    {otherTypes.map((x) => (
                      <Link key={x.slug} href={`/${x.slug}/${district!.slug}`} className="inline-flex h-8 items-center rounded-full bg-surface-2 px-3 text-small font-medium transition-colors hover:bg-primary-soft hover:text-primary-soft-text">
                        {x.nameKa}
                      </Link>
                    ))}
                  </p>
                </>
              )}
              {bt && district && otherDistricts.length > 0 && (
                <>
                  <h2 className="mb-3 mt-5 text-small font-semibold text-muted">{t('landing.otherDistricts')}</h2>
                  <p className="flex flex-wrap gap-2">
                    {otherDistricts.map((d) => (
                      <Link key={d.slug} href={`/${bt.slug}/${d.slug}`} className="inline-flex h-8 items-center rounded-full bg-surface-2 px-3 text-small font-medium transition-colors hover:bg-primary-soft hover:text-primary-soft-text">
                        {d.nameKa}
                      </Link>
                    ))}
                  </p>
                </>
              )}
            </nav>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {permits && bt && (
            <div className="card p-5 md:p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-link/10 text-link">
                <ClipboardCheck className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <h2 className="mt-4 text-h3 font-bold">{t('landing.permits')}</h2>
              <p className="mt-1 text-small text-muted">{t('landing.permitsLead')}</p>
              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-link marker:hidden [&::-webkit-details-marker]:hidden">
                  {t('landing.permitsOpen')}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
                </summary>
                <PermitsBody md={permits.bodyMd} />
              </details>
            </div>
          )}
          <div className="hero-gradient relative overflow-hidden rounded-card p-6 shadow-md">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/12 text-white">
              <MessageSquarePlus className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="mt-4 text-h3 font-bold">{t('landing.demandTitle')}</h2>
            <p className="mt-1 text-small text-white/80">{t('landing.demandLead')}</p>
            <Button asChild variant="accent" className="mt-5 w-full">
              <Link href="/demand/new">{t('landing.demandCta')}</Link>
            </Button>
          </div>
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
