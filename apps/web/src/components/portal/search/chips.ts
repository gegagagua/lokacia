import {
  DEAL_TYPE_LABELS_KA, PASSPORT_FIELD_BY_KEY, PASSPORT_KEYS, formatNumber, type PassportKey, type SearchFilters,
} from '@lokacia/contracts';
import { CITY_NAMES_KA } from '@/lib/site';

export type Chip = { id: string; key: keyof SearchFilters; label: string; value?: string; numeric?: number };
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Human-readable, removable chips for active filters (shared by NL search and the search page). */
export function filterChips(f: Partial<SearchFilters>, ctx: { typeNames: Record<string, string>; districtNames: Record<string, string>; t: Translate; flags?: Partial<Record<'onlyOwners' | 'verifiedOnly' | 'offPlan' | 'hasVideo', string>> }): Chip[] {
  const { t } = ctx;
  const chips: Chip[] = [];
  if (f.businessType) chips.push({ id: 'businessType', key: 'businessType', label: ctx.typeNames[f.businessType] ?? f.businessType });
  if (f.dealType) chips.push({ id: 'dealType', key: 'dealType', label: DEAL_TYPE_LABELS_KA[f.dealType] });
  if (f.city) chips.push({ id: 'city', key: 'city', label: CITY_NAMES_KA[f.city] ?? f.city });
  for (const d of f.districts ?? []) chips.push({ id: `district:${d}`, key: 'districts', value: d, label: ctx.districtNames[d] ?? d });
  if (f.priceMin != null) chips.push({ id: 'priceMin', key: 'priceMin', numeric: f.priceMin, label: t('chip.priceFrom', { value: formatNumber(f.priceMin) }) });
  if (f.priceMax != null) chips.push({ id: 'priceMax', key: 'priceMax', numeric: f.priceMax, label: t('chip.priceTo', { value: formatNumber(f.priceMax) }) });
  if (f.areaMin != null) chips.push({ id: 'areaMin', key: 'areaMin', numeric: f.areaMin, label: t('chip.areaFrom', { value: formatNumber(f.areaMin) }) });
  if (f.areaMax != null) chips.push({ id: 'areaMax', key: 'areaMax', numeric: f.areaMax, label: t('chip.areaTo', { value: formatNumber(f.areaMax) }) });
  const flags = ctx.flags ?? { onlyOwners: t('onlyOwners'), verifiedOnly: t('verifiedOnly'), offPlan: t('offPlan'), hasVideo: t('hasVideo') };
  for (const k of ['onlyOwners', 'verifiedOnly', 'offPlan', 'hasVideo'] as const) if (f[k]) chips.push({ id: k, key: k, label: flags[k] ?? k });
  if (f.scoreMin != null) chips.push({ id: 'scoreMin', key: 'scoreMin', label: t('chip.score', { value: f.scoreMin }) });
  if (f.q) chips.push({ id: 'q', key: 'q', label: t('chip.keyword', { value: f.q }) });
  if (f.lat != null && f.lng != null) chips.push({ id: 'radius', key: 'radiusM', label: t('chip.radius', { value: formatNumber(f.radiusM ?? 1000) }) });
  if (f.bbox) chips.push({ id: 'bbox', key: 'bbox', label: t('areaChip') });
  for (const k of PASSPORT_KEYS) {
    const v = f[k];
    if (v === undefined || v === null || v === false) continue;
    const meta = PASSPORT_FIELD_BY_KEY[k as PassportKey];
    const label = meta.kind === 'boolean' ? meta.labelKa : `${meta.labelKa} ≥ ${formatNumber(Number(v), 1)}${meta.unit ? ` ${meta.unit}` : ''}`;
    chips.push({ id: k, key: k, label, numeric: meta.kind === 'boolean' ? undefined : Number(v) });
  }
  return chips;
}

export function removeChip(f: SearchFilters, chip: Chip): SearchFilters {
  const next = { ...f } as Record<string, unknown>;
  if (chip.key === 'districts' && chip.value) {
    const rest = (f.districts ?? []).filter((d) => d !== chip.value);
    next.districts = rest.length ? rest : undefined;
  } else if (chip.id === 'radius') {
    delete next.lat;
    delete next.lng;
    delete next.radiusM;
  } else {
    delete next[chip.key];
    if (chip.key === 'city') delete next.districts;
  }
  return next as SearchFilters;
}

/** "3 200 ₾" → "3.2k" style short labels for map pins. */
export function shortPrice(minor: number): string {
  const v = minor / 100;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ₾`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k ₾`;
  return `${Math.round(v)} ₾`;
}

/** Number of user-set filters (sort excluded). */
export function activeFilterCount(f: Partial<SearchFilters>): number {
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (k === 'sort' || k === 'lng' || k === 'radiusM') continue;
    if (v === undefined || v === null || v === '' || v === false) continue;
    n += Array.isArray(v) && k === 'districts' ? v.length : 1;
  }
  return n;
}
