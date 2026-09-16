import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Phone } from 'lucide-react';
import { filtersToParams, type SearchFilters } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Badge, Button, SpecRow } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { getDemand, getDemandMatches, getNames } from '@/components/portal/data';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';
import { FavoritesProvider } from '@/components/portal/favorites';
import { ListingGrid } from '@/components/portal/listing-card-link';
import { BusinessTypeIcon } from '@/components/portal/business-type-icon';
import { DemandStatusBadge, areaRange, daysLeft } from '@/components/portal/demand/demand-card';
import { DemandContactForm, DemandOwnerActions } from '@/components/portal/demand/demand-actions';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await getDemand(id).catch(() => null);
  if (!d) return { title: (await getTranslations('demand.detail'))('metaFallback'), robots: { index: false } };
  const f = await getFormat();
  const desc = `${d.businessTypeName}, ${areaRange(d, f.areaUnit)}${d.budgetMinor ? `, ≤ ${f.money(d.budgetMinor)}` : ''}${d.districts.length ? ` — ${d.districts.map((x) => x.name).join(', ')}` : ''}`;
  return pageMetadata({ title: d.title, description: desc, path: `/demand/${d.id}`, noindex: d.status !== 'active' });
}

export default async function DemandDetailPage({ params }: Props) {
  const { id } = await params;
  const [d, user, names] = await Promise.all([getDemand(id).catch(() => null), getSession(), getNames()]);
  if (!d) notFound();
  const t = await getTranslations('demand');
  const f = await getFormat();
  const matches = await getDemandMatches(d.id).catch(() => null);
  const icon = names.typeBySlug[d.businessType]?.icon ?? 'store';
  const left = daysLeft(d.expiresAt);
  const searchHref = matches ? `/search?${filtersToParams(matches.filters as Partial<SearchFilters>)}` : '/search';

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { name: 'lokacia.ge', href: '/' },
          { name: t('board.crumb'), href: '/demand' },
          { name: d.title, href: `/demand/${d.id}` },
        ]}
      />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary" icon={<BusinessTypeIcon name={icon} className="size-3.5" />}>
              {d.businessTypeName}
            </Badge>
            <Badge tone="outline">{f.dealType(d.dealType)}</Badge>
            <DemandStatusBadge status={d.status} />
          </div>
          <h1 className="mt-3 text-h2 font-semibold md:text-h1">{d.title}</h1>
          <p className="mt-2 text-small text-muted">
            {t('detail.published', { date: f.date(d.createdAt) })}
            {d.status === 'active' && ` · ${t('detail.expires', { date: f.date(d.expiresAt) })} (${left === 0 ? t('card.expiresToday') : t('card.expiresIn', { days: left })})`}
          </p>

          <div className="mt-6 rounded-card border border-border bg-surface p-5">
            <SpecRow label={t('card.area')} value={areaRange(d, f.areaUnit)} />
            <SpecRow label={t('card.budget')} value={d.budgetMinor ? `≤ ${f.money(d.budgetMinor)}` : t('card.budgetAny')} />
            <SpecRow label={t('card.districts')} value={d.districts.length ? d.districts.map((x) => x.name).join(', ') : t('card.anyDistrict')} />
            <SpecRow label={t('detail.requester')} value={[d.requester.name, d.requester.companyName, d.requester.activity].filter(Boolean).join(' · ')} />
          </div>

          {d.description && (
            <section className="mt-6">
              <h2 className="text-h3 font-semibold">{t('detail.description')}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{d.description}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {d.mine ? (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
              <p className="font-medium">{t('detail.yours')}</p>
              {d.contactPhone && (
                <p className="flex items-center gap-2 text-small">
                  <Phone className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                  <span className="text-muted">{t('detail.contactPhone')}:</span>
                  <span className="tabular">{d.contactPhone}</span>
                </p>
              )}
              <p className="text-small text-muted">{t('card.contacts', { count: d.contactsCount })}</p>
              <DemandOwnerActions id={d.id} status={d.status} />
            </div>
          ) : d.status === 'active' ? (
            <DemandContactForm id={d.id} loggedIn={!!user} />
          ) : (
            <p className="rounded-card border border-border bg-surface p-5 text-muted">{t('detail.inactive')}</p>
          )}
          <Button asChild variant="ghost" className="self-start">
            <Link href="/demand">
              <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
              {t('detail.back')}
            </Link>
          </Button>
        </aside>
      </div>

      <section className="mt-12" aria-labelledby="matches">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="matches" className="text-h3 font-semibold md:text-h2">
              {t('detail.matches')} {matches ? <span className="text-muted tabular">({matches.total})</span> : null}
            </h2>
            <p className="mt-1 text-small text-muted">{t('detail.matchesHint')}</p>
          </div>
          {matches && matches.total > 0 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={searchHref}>{t('detail.searchAll')}</Link>
            </Button>
          )}
        </div>
        {matches && matches.items.length ? (
          <FavoritesProvider loggedIn={!!user}>
            <ListingGrid listings={matches.items.slice(0, 9)} typeNames={names.typeNames} />
          </FavoritesProvider>
        ) : (
          <p className="rounded-card border border-dashed border-border-strong p-6 text-muted">{t('detail.matchesEmpty')}</p>
        )}
      </section>
    </div>
  );
}
