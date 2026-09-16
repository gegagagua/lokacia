import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { describeFilters, filtersToParams, formatNumber, paramsToFilters, type SearchFilters } from '@lokacia/contracts';
import { getNames, searchListings, type SearchResponse } from '@/components/portal/data';
import { pageMetadata } from '@/components/portal/seo';
import { SearchView } from '@/components/portal/search/search-view';
import { activeFilterCount } from '@/components/portal/search/chips';
import { getSession } from '@/lib/session';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function firstPage(filters: SearchFilters): Promise<SearchResponse | null> {
  const p = filtersToParams(filters);
  p.set('limit', '24');
  return searchListings(p.toString()).catch(() => null);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations('search.meta');
  const filters = paramsToFilters(await searchParams);
  const names = await getNames();
  const summary = describeFilters(filters, { businessType: (s) => names.typeNames[s], district: (s) => names.districtNames[s] });
  const hasFilters = activeFilterCount(filters) > 0;
  const res = await firstPage(filters);
  const canonical = filters.businessType ? `/search?businessType=${encodeURIComponent(filters.businessType)}` : '/search';
  return pageMetadata({
    title: hasFilters ? t('titleWith', { filters: summary }) : t('title'),
    description: t('description', { count: formatNumber(res?.total ?? 0), filters: summary }),
    path: canonical,
    noindex: activeFilterCount(filters) > 2 || !!filters.bbox || !!filters.q,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const filters = paramsToFilters(await searchParams);
  const [names, res, session] = await Promise.all([getNames(), firstPage(filters), getSession()]);
  return (
    <SearchView
      initialFilters={filters}
      initialResult={res ? { items: res.items, total: res.total, nextCursor: res.nextCursor } : null}
      types={names.types.map((t) => ({ slug: t.slug, nameKa: t.nameKa, icon: t.icon, filterConfig: t.filterConfig }))}
      districts={names.districts.map((d) => ({ slug: d.slug, nameKa: d.nameKa, city: d.city }))}
      typeNames={names.typeNames}
      districtNames={names.districtNames}
      loggedIn={!!session}
    />
  );
}
