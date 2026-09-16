import 'server-only';
import { cache } from 'react';
import { localizedName, localizeFilterDef } from '@lokacia/contracts';
import { getAppLocale } from '@/i18n/server';
import { api } from './api-server';

export type BusinessTypeDto = { id: string; slug: string; nameKa: string; nameEn: string; nameRu: string; icon: string; utilityCoef: number; fitoutPerM2Minor: number; filterConfig: { filters: { key: string; kind: 'boolean' | 'min'; labelKa: string; unit?: string; min?: number; max?: number; step?: number }[]; required: string[] } };
export type DistrictDto = { id: string; slug: string; city: string; nameKa: string; nameEn: string; nameRu: string; centerLat: number; centerLng: number; avgPriceM2Minor: number; activeCount: number; vacancyCount: number };

const fetchBusinessTypes = cache(() => api<BusinessTypeDto[]>('/v1/taxonomy/business-types', { auth: false, revalidate: 300 }));
const fetchDistricts = cache((city?: string) => api<DistrictDto[]>(`/v1/taxonomy/districts${city ? `?city=${city}` : ''}`, { auth: false, revalidate: 300 }));

/**
 * Business types for the request locale. For en/ru the display fields (`nameKa`, filter `labelKa`/`unit`) carry the localized
 * values (fallback ka) so every existing consumer renders the active language; `nameEn`/`nameRu` stay untouched.
 */
export const getBusinessTypes = cache(async () => {
  const [types, locale] = await Promise.all([fetchBusinessTypes(), getAppLocale()]);
  if (locale === 'ka') return types;
  return types.map((t) => ({
    ...t,
    nameKa: localizedName(t, locale),
    filterConfig: { ...t.filterConfig, filters: t.filterConfig.filters.map((f) => localizeFilterDef(f, locale)) },
  }));
});

/** Districts for the request locale (`nameKa` holds the localized display name for en/ru, see getBusinessTypes). */
export const getDistricts = cache(async (city?: string) => {
  const [districts, locale] = await Promise.all([fetchDistricts(city), getAppLocale()]);
  return locale === 'ka' ? districts : districts.map((d) => ({ ...d, nameKa: localizedName(d, locale) }));
});
