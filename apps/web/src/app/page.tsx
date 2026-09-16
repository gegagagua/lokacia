import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BadgeCheck, Building2, Clock, KanbanSquare, Map as MapIcon, MessageSquarePlus, Search } from 'lucide-react';
import { type DemandDto, type ListingCard, type SiteStatsDto } from '@lokacia/contracts';
import { Badge, Button, SpacePlan } from '@lokacia/ui';
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
          ],
        }}
      />

      {/* Hero */}
      <section className="drawing-grid border-b border-border">
        <div className="container-page grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[1.25fr_1fr]">
          <div className="min-w-0">
            <p className="text-small font-medium uppercase tracking-wide text-muted">{t('hero.eyebrow')}</p>
            <h1 className="mt-2 text-h1 font-semibold md:text-display">{t('hero.title')}</h1>
            <p className="mt-4 max-w-xl text-[17px] text-muted">{t('hero.lead')}</p>
            <NlSearchBox size="lg" className="mt-6" typeNames={names.typeNames} districtNames={names.districtNames} showExamples />
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/search">
                  {t('hero.browse')}
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/account/listings/new">{t('hero.publish')}</Link>
              </Button>
            </div>
          </div>
          <figure className="hidden rounded-card border border-border bg-surface p-6 lg:block">
            <SpacePlan areaM2={64} widthM={8} depthM={8} ceilingM={3.4} powerKw={25} locale={f.locale} />
            <figcaption className="mt-3 border-t border-border pt-3 text-small text-muted">{t('hero.planCaption')}</figcaption>
          </figure>
        </div>
      </section>

      {/* Business types */}
      <section className="container-page py-12" aria-labelledby="types-h">
        <h2 id="types-h" className="text-h3 font-semibold md:text-h2">
          {t('types.title')}
        </h2>
        <p className="mt-1 text-muted">{t('types.subtitle')}</p>
        <ul className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
          {names.types.map((bt) => (
            <li key={bt.slug} className="bg-surface">
              <Link href={`/${bt.slug}`} className="group flex h-full items-center gap-3 p-4 transition-colors duration-150 hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-button border border-border text-primary">
                  <BusinessTypeIcon name={bt.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{bt.nameKa}</span>
                  <span className="block text-small text-muted tabular">{t('types.count', { count: typeCounts.get(bt.slug) ?? 0 })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust stats */}
      {statItems.length > 0 && (
        <section className="border-y border-border bg-surface" aria-labelledby="stats-h">
          <div className="container-page py-8">
            <h2 id="stats-h" className="sr-only">
              {t('stats.title')}
            </h2>
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {statItems.map((s) => (
                <div key={s.label} className="border-l border-border-strong pl-3">
                  <dd className="compact text-h2 font-semibold tabular">{f.number(s.value)}</dd>
                  <dt className="text-small text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Fresh & VIP */}
      {fresh.items.length > 0 && (
        <section className="container-page py-12" aria-labelledby="fresh-h">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="fresh-h" className="text-h3 font-semibold md:text-h2">
              {t('fresh.title')}
            </h2>
            <Link href="/search?sort=newest" className="inline-flex items-center gap-1 text-link hover:underline">
              {t('fresh.all')}
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
          <FavoritesProvider loggedIn={!!session}>
            <ListingGrid listings={fresh.items} typeNames={names.typeNames} />
          </FavoritesProvider>
        </section>
      )}

      {/* District price snapshot + demand teaser */}
      <section className="container-page grid gap-8 pb-12 lg:grid-cols-2">
        {priced.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-5 md:p-6" aria-labelledby="districts-h">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="districts-h" className="text-h3 font-semibold">
                  {t('districts.title')}
                </h2>
                <p className="text-small text-muted">{t('districts.subtitle')}</p>
              </div>
              <Link href="/map" className="inline-flex shrink-0 items-center gap-1 text-small text-link hover:underline">
                <MapIcon className="size-4" strokeWidth={1.5} aria-hidden />
                {t('districts.map')}
              </Link>
            </div>
            <table className="w-full text-[15px]">
              <thead className="sr-only">
                <tr>
                  <th>{t('districts.district')}</th>
                  <th>{t('districts.price')}</th>
                  <th>{t('districts.active')}</th>
                </tr>
              </thead>
              <tbody>
                {priced.map((d) => (
                  <tr key={d.slug} className="border-t border-border first:border-t-0">
                    <td className="py-2 pr-3">
                      <Link href={`/districts/${d.slug}`} className="hover:text-link hover:underline">
                        {names.districtNames[d.slug] ?? d.name}
                      </Link>
                    </td>
                    <td className="w-1/2 py-2" aria-hidden>
                      <span className="block h-1.5 rounded-full bg-primary/80" style={{ width: `${Math.max(6, ((d.avgPriceM2Minor ?? 0) / maxPrice) * 100)}%` }} />
                    </td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right font-medium tabular">{f.money(Math.round((d.avgPriceM2Minor ?? 0) / 100) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-card border border-border bg-surface p-5 md:p-6" aria-labelledby="demand-h">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="demand-h" className="text-h3 font-semibold">
                {t('demand.title')}
              </h2>
              <p className="text-small text-muted">{t('demand.subtitle')}</p>
            </div>
            <Link href="/demand" className="shrink-0 text-small text-link hover:underline">
              {t('demand.all')}
            </Link>
          </div>
          {demand.items.length ? (
            <ul className="divide-y divide-border">
              {demand.items.map((d) => (
                <li key={d.id} className="py-3">
                  <Link href={`/demand/${d.id}`} className="font-medium hover:text-link hover:underline">
                    {d.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-small text-muted">
                    <Badge tone="neutral">{names.typeNames[d.businessType] ?? d.businessTypeName}</Badge>
                    <Badge tone="outline">{f.dealType(d.dealType)}</Badge>
                    {(d.areaMin || d.areaMax) && <span className="tabular">{t('demand.area', { min: d.areaMin ?? 0, max: d.areaMax ?? '∞' })}</span>}
                    {d.budgetMinor ? <span className="tabular">· {t('demand.budget', { amount: f.money(d.budgetMinor) })}</span> : null}
                    {d.districts.length > 0 && <span>· {d.districts.map((x) => names.districtNames[x.slug] ?? x.name).join(', ')}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-muted">{t('demand.empty')}</p>
          )}
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link href="/demand/new">
              <MessageSquarePlus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('demand.add')}
            </Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface" aria-labelledby="how-h">
        <div className="container-page py-12">
          <h2 id="how-h" className="text-h3 font-semibold md:text-h2">
            {t('how.title')}
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {how.map((col) => (
              <div key={col.key} className="flex flex-col rounded-card border border-border bg-bg p-5">
                <col.icon className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-3 text-h3 font-semibold">{t(`how.${col.key}`)}</h3>
                <ol className="mt-3 flex flex-1 flex-col gap-3">
                  {col.steps.map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border-strong text-small tabular">{i + 1}</span>
                      <span>{t(`how.${s}`)}</span>
                    </li>
                  ))}
                </ol>
                <Link href={col.href} className="mt-5 inline-flex items-center gap-1 font-medium text-link hover:underline">
                  {t(`how.${col.cta}`)}
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className="container-page grid gap-4 py-12 md:grid-cols-2">
        <div className="rounded-card border border-primary bg-primary p-6 text-primary-contrast md:p-8">
          <BadgeCheck className="size-7" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-3 text-h3 font-semibold md:text-h2">{t('cta.ownerTitle')}</h2>
          <p className="mt-2 opacity-90">{t('cta.ownerLead')}</p>
          <Button asChild variant="accent" className="mt-6">
            <Link href="/account/listings/new">{t('cta.ownerCta')}</Link>
          </Button>
        </div>
        <div className="rounded-card border border-border-strong bg-surface p-6 md:p-8">
          <Clock className="size-7 text-link" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-3 text-h3 font-semibold md:text-h2">{t('cta.brokerTitle')}</h2>
          <p className="mt-2 text-muted">{t('cta.brokerLead')}</p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/pricing">{t('cta.brokerCta')}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
