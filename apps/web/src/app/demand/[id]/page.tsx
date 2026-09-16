import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Phone, Ruler, SearchX, UserRound, Wallet } from 'lucide-react';
import { filtersToParams, type SearchFilters } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { Badge, Button, EmptyState } from '@lokacia/ui';
import { getSession } from '@/lib/session';
import { getDemand, getDemandMatches, getNames } from '@/components/portal/data';
import { pageMetadata } from '@/components/portal/seo';
import { PageHero, SectionHead } from '@/components/portal/page-hero';
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

  const facts = [
    { icon: Ruler, label: t('card.area'), value: areaRange(d, f.areaUnit) },
    { icon: Wallet, label: t('card.budget'), value: d.budgetMinor ? `≤ ${f.money(d.budgetMinor)}` : t('card.budgetAny') },
    { icon: MapPin, label: t('card.districts'), value: d.districts.length ? d.districts.map((x) => x.name).join(', ') : t('card.anyDistrict') },
    { icon: UserRound, label: t('detail.requester'), value: [d.requester.name, d.requester.companyName, d.requester.activity].filter(Boolean).join(' · ') },
  ];

  return (
    <>
      <PageHero
        size="sm"
        crumbs={[
          { name: 'lokacia.ge', href: '/' },
          { name: t('board.crumb'), href: '/demand' },
          { name: d.title, href: `/demand/${d.id}` },
        ]}
        eyebrow={d.businessTypeName}
        eyebrowIcon={<BusinessTypeIcon name={icon} className="size-3.5" />}
        title={d.title}
        lead={
          <span className="flex flex-wrap items-center gap-2 text-[15px]">
            <Badge tone="outline">{f.dealType(d.dealType)}</Badge>
            <DemandStatusBadge status={d.status} />
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" strokeWidth={2} aria-hidden />
              {t('detail.published', { date: f.date(d.createdAt) })}
              {d.status === 'active' && ` · ${t('detail.expires', { date: f.date(d.expiresAt) })} (${left === 0 ? t('card.expiresToday') : t('card.expiresIn', { days: left })})`}
            </span>
          </span>
        }
      />

      <div className="container-page py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map((x) => (
                <div key={x.label} className="card flex items-start gap-3 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">
                    <x.icon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-small text-muted">{x.label}</dt>
                    <dd className="text-[17px] font-semibold leading-snug tabular">{x.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {d.description && (
              <section className="card mt-6 p-5 md:p-6">
                <h2 className="text-h3 font-bold">{t('detail.description')}</h2>
                <p className="mt-3 whitespace-pre-line text-[16.5px] leading-relaxed">{d.description}</p>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {d.mine ? (
              <div className="card flex flex-col gap-4 p-5">
                <p className="font-semibold">{t('detail.yours')}</p>
                {d.contactPhone && (
                  <p className="flex items-center gap-2 text-small">
                    <Phone className="size-4 text-muted" strokeWidth={2} aria-hidden />
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
              <p className="card p-5 text-muted">{t('detail.inactive')}</p>
            )}
            <Button asChild variant="ghost" className="self-start">
              <Link href="/demand">
                <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
                {t('detail.back')}
              </Link>
            </Button>
          </aside>
        </div>

        <section className="mt-14 md:mt-20" aria-labelledby="matches">
          <SectionHead
            id="matches"
            title={
              <>
                {t('detail.matches')} {matches ? <span className="text-muted tabular">({matches.total})</span> : null}
              </>
            }
            lead={t('detail.matchesHint')}
            action={
              matches && matches.total > 0 ? (
                <Button asChild variant="secondary">
                  <Link href={searchHref}>
                    {t('detail.searchAll')}
                    <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                  </Link>
                </Button>
              ) : undefined
            }
          />
          {matches && matches.items.length ? (
            <FavoritesProvider loggedIn={!!user}>
              <ListingGrid listings={matches.items.slice(0, 9)} typeNames={names.typeNames} />
            </FavoritesProvider>
          ) : (
            <EmptyState icon={<SearchX className="size-6" strokeWidth={2} aria-hidden />} title={t('detail.matchesEmpty')} />
          )}
        </section>
      </div>
    </>
  );
}
