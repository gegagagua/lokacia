import 'server-only';
import { cache } from 'react';
import type {
  AgencyProfileDto, BrokerProfileDto, CompareSharedDto, DemandDto, LandingDto, ListingCard, ListingDetail, Paginated, ProjectDetailDto, ProjectDto,
  ProviderDetailDto, ProviderDto, SiteStatsDto,
} from '@lokacia/contracts';
import { api, apiOrNull } from '@/lib/api-server';
import { getBusinessTypes, getDistricts, type BusinessTypeDto, type DistrictDto } from '@/lib/taxonomy';

/** Typed server-side data access for public portal pages (stream A). Public data is ISR-cached. */

export type SearchResponse = Paginated<ListingCard> & { total: number; tookMs: number };
export type ListingPageData = ListingDetail & { canManage: boolean };
export type Insights = {
  radiusM: number;
  categories: { category: string; label: string; count: number; nearest: { name: string; distanceM: number; lat: number; lng: number }[] }[];
  price: { perM2Minor: number; districtAvgM2Minor: number; deltaPct: number; verdict: 'above' | 'below' | 'fair'; recommendedMinor: number; districtName: string | null } | null;
  district: { id: string; name: string; slug: string } | null;
};
export type DistrictStat = { id: string; slug: string; name: string; center: [number, number]; avgPriceM2Minor: number | null; activeCount: number; vacancyCount: number; medianAreaM2: number | null };
export type CmsPage = { id: string; slug: string; title: string; bodyMd: string; updatedAt: string };

export const getListing = cache((slug: string) => apiOrNull<ListingPageData>(`/v1/listings/${encodeURIComponent(slug)}`));
export const getListingPublic = cache((slug: string) => apiOrNull<ListingPageData>(`/v1/listings/${encodeURIComponent(slug)}?track=0`, { auth: false, revalidate: 300 }));
export const getSimilar = cache((id: string) => api<ListingCard[]>(`/v1/listings/${id}/similar`, { auth: false, revalidate: 300 }).catch(() => [] as ListingCard[]));
export const searchListings = (qs: string) => api<SearchResponse>(`/v1/listings?${qs}`, { auth: false, revalidate: 60 });
export const getInsights = cache((qs: string) => api<Insights>(`/v1/geo/insights?${qs}`, { auth: false, revalidate: 3600 }).catch(() => null));
export const getPermits = cache((slug: string) => apiOrNull<CmsPage>(`/v1/taxonomy/permits/${encodeURIComponent(slug)}`, { auth: false, revalidate: 3600 }));
export const getCmsPage = cache((slug: string) => apiOrNull<CmsPage>(`/v1/taxonomy/pages/${encodeURIComponent(slug)}`, { auth: false, revalidate: 3600 }));
export const getDistrictStats = cache((qs = '') => api<DistrictStat[]>(`/v1/geo/districts/stats${qs ? `?${qs}` : ''}`, { auth: false, revalidate: 600 }));

export const getSiteStats = cache(() => api<SiteStatsDto>('/v1/seo/stats', { auth: false, revalidate: 120 }));
export const getLanding = cache((businessType?: string, district?: string) => {
  const p = new URLSearchParams();
  if (businessType) p.set('businessType', businessType);
  if (district) p.set('district', district);
  return apiOrNull<LandingDto>(`/v1/seo/landing?${p}`, { auth: false, revalidate: 300 });
});
export const getCombos = cache(() => api<{ businessType: string; district: string; city: string; count: number }[]>('/v1/seo/combos', { auth: false, revalidate: 900 }));

export const getDemandList = (qs: string) => api<Paginated<DemandDto> & { total: number }>(`/v1/demand?${qs}`, { auth: false, revalidate: 60 });
export const getDemand = (id: string) => apiOrNull<DemandDto & { contactPhone: string | null }>(`/v1/demand/${encodeURIComponent(id)}`);
export const getDemandMatches = (id: string) => api<{ items: ListingCard[]; total: number; filters: Record<string, unknown> }>(`/v1/demand/${encodeURIComponent(id)}/matches`, { auth: false, revalidate: 120 });

export const getServiceCategories = cache(() => api<{ slug: string; nameKa: string; count: number }[]>('/v1/services/categories', { auth: false, revalidate: 600 }));
export const getProviders = (qs: string) => api<Paginated<ProviderDto> & { total: number }>(`/v1/services/providers?${qs}`, { auth: false, revalidate: 120 });
export const getProvider = cache((slug: string) => apiOrNull<ProviderDetailDto>(`/v1/services/providers/${encodeURIComponent(slug)}`));

export const getProjects = cache(() => api<ProjectDto[]>('/v1/projects', { auth: false, revalidate: 300 }));
export const getProject = cache((slug: string) => apiOrNull<ProjectDetailDto>(`/v1/projects/${encodeURIComponent(slug)}`, { auth: false, revalidate: 300 }));

export const getBroker = cache((slug: string) => apiOrNull<BrokerProfileDto>(`/v1/profiles/brokers/${encodeURIComponent(slug)}`, { auth: false, revalidate: 300 }));
export const getAgency = cache((slug: string) => apiOrNull<AgencyProfileDto>(`/v1/profiles/agencies/${encodeURIComponent(slug)}`, { auth: false, revalidate: 300 }));
export const getCompareShared = (token: string) => apiOrNull<CompareSharedDto>(`/v1/compare/shared/${encodeURIComponent(token)}`, { auth: false, revalidate: 60 });

/** Business-type & district name lookups for cards and chips. */
export const getNames = cache(async () => {
  const [types, districts] = await Promise.all([getBusinessTypes().catch(() => [] as BusinessTypeDto[]), getDistricts().catch(() => [] as DistrictDto[])]);
  const typeBySlug = Object.fromEntries(types.map((t) => [t.slug, t]));
  const districtBySlug = Object.fromEntries(districts.map((d) => [d.slug, d]));
  return {
    types,
    districts,
    typeBySlug,
    districtBySlug,
    typeNames: Object.fromEntries(types.map((t) => [t.slug, t.nameKa])) as Record<string, string>,
    districtNames: Object.fromEntries(districts.map((d) => [d.slug, d.nameKa])) as Record<string, string>,
  };
});

export { getBusinessTypes, getDistricts, type BusinessTypeDto, type DistrictDto };
