import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, ArrowUpRight, BadgeCheck, Building2, KanbanSquare, Map as MapIcon, MessageSquarePlus, Plus, Search, Sparkles } from 'lucide-react';
import { localizedText, type DemandDto, type ListingCard, type SiteStatsDto } from '@lokacia/contracts';
import { Badge, Button, EmptyState, SpacePlan, cn } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { getFormat } from '@/i18n/server';
import { absUrl, SITE_NAME } from '@/lib/site';
import { getCombos, getDemandList, getDistrictStats, getNames, getSiteStats, searchListings, type DistrictStat } from '@/components/portal/data';
import { BusinessTypeIcon } from '@/components/portal/business-type-icon';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
import { NlSearchBox } from '@/components/portal/nl-search';
import { JsonLd, pageMetadata } from '@/components/portal/seo';

export const revalidate = 120;

export async function generateMetadata() {
  const t = await getTranslations('home.meta');
  return pageMetadata({ title: t('title'), description: t('description'), path: '/' });
}

const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

/** Rotating soft tints for icon tiles (semantic tokens only). */
const TINTS = [
  'bg-primary-soft text-primary-soft-text',
  'bg-accent-soft text-text',
  'bg-link/10 text-link',
  'bg-success/12 text-success',
] as const;

const FAQ = ['1', '2', '3', '4', '5'] as const;

export default async function HomePage() {
  const t = await getTranslations('home');
  const f = await getFormat();
  const [names, stats, fresh, districts, combos, demand, session] = await Promise.all([
    getNames(),
    safe<SiteStatsDto | null>(getSiteStats(), null),
    safe(searchListings('limit=6&sort=newest'), { items: [] as ListingCard[], total: 0, nextCursor: null, tookMs: 0 }),
    safe<DistrictStat[]>(getDistrictStats('city=tbilisi'), []),
    safe(getCombos(), []),
    safe(getDemandList('limit=3'), { items: [] as DemandDto[], total: 0, nextCursor: null }),
    getSession(),
  ]);

  const typeCounts = new Map<string, number>();
  for (const c of combos) typeCounts.set(c.businessType, (typeCounts.get(c.businessType) ?? 0) + c.count);
  const priced = districts.filter((d) => d.avgPriceM2Minor).sort((a, b) => (b.avgPriceM2Minor ?? 0) - (a.avgPriceM2Minor ?? 0)).slice(0, 8);
  const maxPrice = Math.max(1, ...priced.map((d) => d.avgPriceM2Minor ?? 0));
  const collage = fresh.items.filter((l) => l.cover).slice(0, 2);
  const lead = collage[0];

  const statItems = stats
    ? [
        { label: t('stats.active'), value: stats.activeListings },
        { label: t('stats.confirmed'), value: stats.confirmedLast14d },
        { label: t('stats.verified'), value: stats.verifiedOwners },
        { label: t('stats.brokers'), value: stats.brokers + stats.agencies },
        { label: t('stats.demand'), value: stats.activeDemand },
        { label: t('stats.newWeek'), value: stats.newThisWeek },
      ]
    : [];

  const how = [
    { key: 'tenants', icon: Search, steps: ['t1', 't2', 't3'], href: '/search', cta: 'tenantsCta' },
    { key: 'owners', icon: Building2, steps: ['o1', 'o2', 'o3'], href: '/account/listings/new', cta: 'ownersCta' },
    { key: 'brokers', icon: KanbanSquare, steps: ['b1', 'b2', 'b3'], href: '/pricing', cta: 'brokersCta' },
  ] as const;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', name: SITE_NAME, url: absUrl('/'), logo: absUrl('/icon.svg') },
            { '@type': 'WebSite', name: SITE_NAME, url: absUrl('/'), inLanguage: f.locale, potentialAction: { '@type': 'SearchAction', target: `${absUrl('/search')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
            { '@type': 'FAQPage', mainEntity: FAQ.map((n) => ({ '@type': 'Question', name: t(`faq.q${n}`), acceptedAnswer: { '@type': 'Answer', text: t(`faq.a${n}`) } })) },
          ],
        }}
      />

      {/* Hero */}
      <section className="hero-gradient relative isolate overflow-hidden" aria-labelledby="hero-h">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(color-mix(in_srgb,white_14%,transparent)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-1/3 -z-10 size-[520px] rounded-full bg-accent/20 blur-3xl" />
        <div className="container-page grid items-center gap-12 pb-10 pt-12 md:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:pb-14 lg:pt-24">
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13.5px] font-medium text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur">
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative size-2 rounded-full bg-accent" />
              </span>
              <span className="truncate">{t('hero.eyebrow')}</span>
            </p>
            <h1 id="hero-h" className="mt-5 text-[38px] font-bold leading-[1.12] tracking-tight text-white sm:text-[50px] lg:text-display">
              {t('hero.titleA')} <span className="text-gradient">{t('hero.titleB')}</span> {t('hero.titleC')}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/80 md:text-[18px]">{t('hero.lead')}</p>
            <NlSearchBox size="lg" onDark className="mt-8 max-w-2xl" typeNames={names.typeNames} districtNames={names.districtNames} showExamples />
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/search"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-basalt shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:shadow-ring"
              >
                {t('hero.browse')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link
                href="/account/listings/new"
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:shadow-ring"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                {t('hero.publish')}
              </Link>
            </div>
          </div>

          {/* Photo collage (decorative preview of real listings) */}
          <div className="relative hidden h-[540px] lg:block">
            {lead ? (
              <>
                <Link href={`/listings/${lead.slug}`} className="group absolute right-0 top-2 block w-[80%] overflow-hidden rounded-[28px] shadow-lg ring-1 ring-white/15 focus-visible:outline-none focus-visible:shadow-ring" tabIndex={-1} aria-hidden>
                  <img src={lead.cover!} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </Link>
                {collage[1] && (
                  <Link href={`/listings/${collage[1].slug}`} className="group absolute bottom-20 left-0 block w-[48%] overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/15" tabIndex={-1} aria-hidden>
                    <img src={collage[1].cover!} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </Link>
                )}
                <div className="absolute bottom-2 right-6 w-[330px] rounded-card border border-border bg-surface p-4 text-text shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap rounded-full bg-success/12 px-2.5 py-1 text-[12.5px] font-semibold text-success">
                      <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />
                      {t('hero.confirmedToday')}
                    </span>
                    {lead.vip && <Badge tone="accent">VIP</Badge>}
                  </div>
                  <p className="mt-3 line-clamp-1 font-semibold">{localizedText(lead.title, lead.titleEn, lead.titleRu, f.locale)}</p>
                  <p className="mt-0.5 text-[22px] font-bold tracking-tight tabular">{f.money(lead.priceMinor)}</p>
                </div>
                <div className="absolute left-4 top-16 w-52 rounded-2xl border border-border bg-surface/95 p-3 text-text shadow-md backdrop-blur" aria-hidden>
                  <SpacePlan compact areaM2={lead.areaM2} widthM={lead.passport.widthM} depthM={lead.passport.depthM} locale={f.locale} />
                  <p className="mt-1 text-center text-[12px] font-medium text-muted">{t('hero.collageCaption')}</p>
                </div>
              </>
            ) : (
              <figure className="absolute inset-x-0 top-10 rounded-modal border border-border bg-surface p-8 text-text shadow-lg">
                <SpacePlan areaM2={64} widthM={8} depthM={8} ceilingM={3.4} powerKw={25} locale={f.locale} />
                <figcaption className="mt-3 border-t border-border pt-3 text-small text-muted">{t('hero.planCaption')}</figcaption>
              </figure>
            )}
          </div>
        </div>

        {statItems.length > 0 && (
          <div className="container-page pb-12 md:pb-16">
            <h2 className="sr-only">{t('stats.title')}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {statItems.map((s) => (
                <div key={s.label} className="flex flex-col rounded-2xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-inset ring-white/12 backdrop-blur-md">
                  <dt className="order-2 text-[13px] leading-snug text-white/70">{s.label}</dt>
                  <dd className="order-1 text-[28px] font-bold leading-tight tracking-tight text-white tabular">{f.number(s.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* Business types */}
      <section className="container-page py-16 md:py-24" aria-labelledby="types-h">
        <SectionHead
          eyebrow={t('types.eyebrow')}
          id="types-h"
          title={t('types.title')}
          lead={t('types.subtitle')}
          action={
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/search">
                {t('hero.browse')}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            </Button>
          }
        />
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {names.types.map((bt, i) => (
            <li key={bt.slug} className="flex">
              <Link href={`/${bt.slug}`} className="card card-hover group flex w-full items-center gap-4 p-4 focus-visible:outline-none focus-visible:shadow-ring md:p-5">
                <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-300 ease-out group-hover:scale-110', TINTS[i % TINTS.length])}>
                  <BusinessTypeIcon name={bt.icon} className="size-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{bt.nameKa}</span>
                  <span className="block text-small text-muted tabular">{t('types.count', { count: typeCounts.get(bt.slug) ?? 0 })}</span>
                </span>
                <ArrowUpRight className="size-5 shrink-0 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-text group-hover:opacity-100" strokeWidth={2} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Fresh & VIP */}
      {fresh.items.length > 0 && (
        <section className="container-page pb-16 md:pb-24" aria-labelledby="fresh-h">
          <SectionHead
            eyebrow={t('fresh.eyebrow')}
            id="fresh-h"
            title={t('fresh.title')}
            lead={t('fresh.subtitle')}
            action={
              <Link href="/search?sort=newest" className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-link">
                {t('fresh.all')}
                <span className="grid size-8 place-items-center rounded-full bg-link/10 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </span>
              </Link>
            }
          />
          <FavoritesProvider loggedIn={!!session}>
            <ListingGrid listings={fresh.items} typeNames={names.typeNames} />
          </FavoritesProvider>
        </section>
      )}

      {/* District price snapshot */}
      {priced.length > 0 && (
        <section className="border-y border-border bg-surface" aria-labelledby="districts-h">
          <div className="container-page py-16 md:py-24">
            <SectionHead
              eyebrow={t('districts.eyebrow')}
              id="districts-h"
              title={t('districts.title')}
              lead={t('districts.subtitle')}
              action={
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href="/map">
                    <MapIcon className="size-4" strokeWidth={2} aria-hidden />
                    {t('districts.map')}
                  </Link>
                </Button>
              }
            />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {priced.map((d, i) => {
                const pct = Math.max(8, ((d.avgPriceM2Minor ?? 0) / maxPrice) * 100);
                return (
                  <li key={d.slug} className="flex">
                    <Link href={`/districts/${d.slug}`} className="group flex w-full flex-col rounded-card border border-border bg-bg p-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:bg-surface hover:shadow-md focus-visible:outline-none focus-visible:shadow-ring">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('grid size-8 place-items-center rounded-full text-[13px] font-bold tabular', i < 3 ? 'bg-accent-soft text-text' : 'bg-surface-3 text-muted')}>{i + 1}</span>
                        <span className="text-small text-muted tabular">{t('districts.count', { count: d.activeCount })}</span>
                      </div>
                      <h3 className="mt-4 truncate text-[17px] font-semibold group-hover:text-link">{names.districtNames[d.slug] ?? d.name}</h3>
                      <p className="mt-1 flex items-baseline gap-1">
                        <span className="sr-only">{t('districts.price')}: </span>
                        <span className="text-[28px] font-bold leading-tight tracking-tight tabular">{f.money(Math.round((d.avgPriceM2Minor ?? 0) / 100) * 100)}</span>
                        <span className="text-small font-medium text-muted">{t('districts.perM2')}</span>
                      </p>
                      <span aria-hidden className="mt-4 block h-2 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-gradient-to-r from-primary-500 to-accent" style={{ width: `${pct}%` }} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="container-page py-16 md:py-24" aria-labelledby="how-h">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow">{t('how.eyebrow')}</span>
          <h2 id="how-h" className="mt-4 text-[30px] font-bold leading-tight tracking-tight md:text-h1">
            {t('how.title')}
          </h2>
          <p className="mt-3 text-[17px] text-muted">{t('how.subtitle')}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {how.map((col, ci) => (
            <div key={col.key} className="card card-hover flex flex-col p-6 md:p-7">
              <div className="flex items-center gap-4">
                <span className={cn('grid size-14 shrink-0 place-items-center rounded-2xl', TINTS[ci % TINTS.length])}>
                  <col.icon className="size-6" strokeWidth={2} aria-hidden />
                </span>
                <h3 className="text-h3 font-bold">{t(`how.${col.key}`)}</h3>
              </div>
              <ol className="mt-6 flex flex-1 flex-col">
                {col.steps.map((s, i) => (
                  <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < col.steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-0.5 rounded-full bg-border" />}
                    <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-bold text-primary-contrast tabular shadow-xs">{i + 1}</span>
                    <span className="pt-1 text-[15.5px] leading-relaxed">{t(`how.${s}`)}</span>
                  </li>
                ))}
              </ol>
              <Link href={col.href} className="group mt-6 inline-flex items-center gap-1.5 self-start font-semibold text-link">
                {t(`how.${col.cta}`)}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Demand board teaser */}
      <section className="drawing-grid border-y border-border" aria-labelledby="demand-h">
        <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <span className="eyebrow">{t('demand.eyebrow')}</span>
            <h2 id="demand-h" className="mt-4 text-[30px] font-bold leading-tight tracking-tight md:text-h1">
              {t('demand.title')}
            </h2>
            <p className="mt-3 max-w-md text-[17px] text-muted">{t('demand.subtitle')}</p>
            {stats && stats.activeDemand > 0 && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[15px] font-semibold shadow-xs ring-1 ring-inset ring-border tabular">
                <Sparkles className="size-4 text-accent" strokeWidth={2} aria-hidden />
                {t('demand.active', { count: f.number(stats.activeDemand) })}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/demand/new">
                  <MessageSquarePlus className="size-5" strokeWidth={2} aria-hidden />
                  {t('demand.add')}
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link href="/demand">{t('demand.all')}</Link>
              </Button>
            </div>
          </div>
          {demand.items.length ? (
            <ul className="flex flex-col gap-3">
              {demand.items.map((d, i) => (
                <li key={d.id}>
                  <div className="card card-hover group relative flex gap-4 p-5">
                    <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', TINTS[(i + 1) % TINTS.length])}>
                      <BusinessTypeIcon name={names.typeBySlug[d.businessType]?.icon ?? ''} className="size-[22px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16.5px] font-semibold leading-snug">
                        <Link href={`/demand/${d.id}`} className="after:absolute after:inset-0 group-hover:text-link focus-visible:outline-none">
                          {d.title}
                        </Link>
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-small text-muted">
                        <Badge tone="primary">{names.typeNames[d.businessType] ?? d.businessTypeName}</Badge>
                        <Badge tone="outline">{f.dealType(d.dealType)}</Badge>
                        {(d.areaMin || d.areaMax) && <Badge tone="neutral" className="tabular">{t('demand.area', { min: d.areaMin ?? 0, max: d.areaMax ?? '∞' })}</Badge>}
                        {d.budgetMinor ? <Badge tone="neutral" className="tabular">{t('demand.budget', { amount: f.money(d.budgetMinor) })}</Badge> : null}
                        {d.districts.length > 0 && <span className="truncate pl-1">{d.districts.map((x) => names.districtNames[x.slug] ?? x.name).join(', ')}</span>}
                      </div>
                    </div>
                    <ArrowUpRight className="hidden size-5 shrink-0 text-muted transition-colors group-hover:text-text sm:block" strokeWidth={2} aria-hidden />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('demand.empty')} />
          )}
        </div>
      </section>

      {/* CTAs */}
      <section className="container-page grid gap-6 py-16 md:py-24 lg:grid-cols-2">
        <div className="hero-gradient relative isolate flex flex-col overflow-hidden rounded-modal p-7 shadow-md md:p-10">
          <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-accent/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 -z-10 hidden w-64 rotate-[-6deg] rounded-3xl bg-white/95 p-3 text-basalt opacity-90 shadow-lg sm:block">
            <SpacePlan compact areaM2={96} widthM={12} depthM={8} locale={f.locale} />
          </div>
          <span className="inline-flex self-start rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20">{t('cta.ownerEyebrow')}</span>
          <h2 className="mt-5 text-[28px] font-bold leading-tight tracking-tight text-white md:text-h2">{t('cta.ownerTitle')}</h2>
          <p className="mt-3 max-w-md text-[16.5px] text-white/80">{t('cta.ownerLead')}</p>
          <Button asChild variant="accent" size="lg" className="mt-8 self-start rounded-full">
            <Link href="/account/listings/new">
              <Plus className="size-5" strokeWidth={2} aria-hidden />
              {t('cta.ownerCta')}
            </Link>
          </Button>
        </div>
        <div className="relative isolate flex flex-col overflow-hidden rounded-modal border border-border bg-accent-soft p-7 shadow-sm md:p-10">
          <div aria-hidden className="absolute -bottom-24 -right-16 -z-10 size-72 rounded-full bg-accent/30 blur-3xl" />
          <span className="inline-flex self-start rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-text ring-1 ring-inset ring-border">{t('cta.brokerEyebrow')}</span>
          <h2 className="mt-5 text-[28px] font-bold leading-tight tracking-tight md:text-h2">{t('cta.brokerTitle')}</h2>
          <p className="mt-3 max-w-md text-[16.5px] text-muted">{t('cta.brokerLead')}</p>
          <div className="mt-6 flex gap-2" aria-hidden>
            {[KanbanSquare, MapIcon, BadgeCheck].map((Icon, i) => (
              <span key={i} className="grid size-11 place-items-center rounded-2xl bg-surface text-primary-soft-text shadow-xs">
                <Icon className="size-5" strokeWidth={2} />
              </span>
            ))}
          </div>
          <Button asChild size="lg" className="mt-8 self-start rounded-full">
            <Link href="/pricing">
              {t('cta.brokerCta')}
              <ArrowRight className="size-5" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface" aria-labelledby="faq-h">
        <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="eyebrow">{t('faq.eyebrow')}</span>
            <h2 id="faq-h" className="mt-4 text-[30px] font-bold leading-tight tracking-tight md:text-h1">
              {t('faq.title')}
            </h2>
            <p className="mt-3 max-w-sm text-[17px] text-muted">{t('faq.subtitle')}</p>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((n) => (
              <details key={n} className="group rounded-2xl border border-border bg-bg transition-all duration-200 open:border-border-strong open:bg-surface open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-[16.5px] font-semibold focus-visible:outline-none focus-visible:shadow-ring [&::-webkit-details-marker]:hidden">
                  {t(`faq.q${n}`)}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-soft-text transition-transform duration-200 group-open:rotate-45" aria-hidden>
                    <Plus className="size-4" strokeWidth={2.25} />
                  </span>
                </summary>
                <p className="px-5 pb-5 text-[15.5px] leading-relaxed text-muted">{t(`faq.a${n}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHead({ eyebrow, title, lead, action, id }: { eyebrow: string; title: string; lead?: string; action?: React.ReactNode; id: string }) {
  return (
    <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={id} className="mt-4 text-[30px] font-bold leading-tight tracking-tight md:text-h1">
          {title}
        </h2>
        {lead && <p className="mt-3 text-[17px] text-muted">{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
