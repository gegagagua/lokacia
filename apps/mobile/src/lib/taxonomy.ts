import { BUSINESS_TYPES } from '@lokacia/contracts';
import { endpoints, type BusinessTypeDto, type DistrictDto } from './api';
import { createStore } from './store';

/** Business types / districts cached for the session; contracts seed list is the offline fallback. */
export const businessTypesStore = createStore<BusinessTypeDto[]>(
  BUSINESS_TYPES.map((b) => ({ id: b.slug, slug: b.slug, nameKa: b.nameKa, icon: b.icon, filterConfig: b.filterConfig })),
);
export const districtsStore = createStore<DistrictDto[]>([]);

let loaded = false;
export async function loadTaxonomy() {
  if (loaded) return;
  const [types, districts] = await Promise.all([endpoints.businessTypes().catch(() => null), endpoints.districts().catch(() => null)]);
  if (types?.length) businessTypesStore.set(types);
  if (districts?.length) districtsStore.set(districts);
  loaded = !!types && !!districts;
}
