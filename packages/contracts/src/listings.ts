import { z } from 'zod';
import { DEAL_TYPES, LISTING_STATUSES, PASSPORT_KEYS, type DealType, type ListingStatus, type PassportKey } from './taxonomy';

const boolish = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean());
const numish = z.coerce.number().finite();
const csv = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
  z.array(z.string().min(1)).max(50),
);

export const SEARCH_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'area_desc', 'price_m2_asc', 'score_desc'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const SEARCH_SORT_LABELS_KA: Record<SearchSort, string> = {
  relevance: 'შესაბამისობა',
  newest: 'ახალი',
  price_asc: 'ფასი: ზრდადობით',
  price_desc: 'ფასი: კლებადობით',
  area_desc: 'ფართი: დიდიდან',
  price_m2_asc: 'ფასი მ²-ზე',
  score_desc: 'ლოკაციის ქულა',
};

/** Sort labels per locale (Phase 22). */
export const SEARCH_SORT_LABELS: Record<'ka' | 'en' | 'ru', Record<SearchSort, string>> = {
  ka: SEARCH_SORT_LABELS_KA,
  en: { relevance: 'Relevance', newest: 'Newest', price_asc: 'Price: low to high', price_desc: 'Price: high to low', area_desc: 'Area: largest first', price_m2_asc: 'Price per m²', score_desc: 'Location score' },
  ru: { relevance: 'По релевантности', newest: 'Сначала новые', price_asc: 'Цена: по возрастанию', price_desc: 'Цена: по убыванию', area_desc: 'Площадь: по убыванию', price_m2_asc: 'Цена за м²', score_desc: 'Оценка локации' },
};

/** Passport filters: booleans must be true; numerics are minimums (`ceilingM=3` → ceiling ≥ 3 m). */
const passportFilterShape = Object.fromEntries(
  PASSPORT_KEYS.map((k) => [k, z.union([boolish, numish]).optional()]),
) as Record<PassportKey, z.ZodOptional<z.ZodUnion<[typeof boolish, typeof numish]>>>;

/** Search filters. Money in whole GEL (URL friendly); area in m². Every key maps 1:1 to a URL param. */
export const searchFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  businessType: z.string().max(40).optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
  city: z.string().max(40).optional(),
  districts: csv.optional(), // district slugs
  priceMin: numish.min(0).optional(),
  priceMax: numish.min(0).optional(),
  areaMin: numish.min(0).optional(),
  areaMax: numish.min(0).optional(),
  onlyOwners: boolish.optional(),
  verifiedOnly: boolish.optional(),
  offPlan: boolish.optional(),
  hasVideo: boolish.optional(),
  scoreMin: numish.min(0).max(100).optional(),
  lat: numish.min(-90).max(90).optional(),
  lng: numish.min(-180).max(180).optional(),
  radiusM: numish.min(50).max(50_000).optional(),
  bbox: z
    .preprocess((v) => (typeof v === 'string' ? v.split(',').map(Number) : v), z.tuple([numish, numish, numish, numish]))
    .optional(), // west,south,east,north
  sort: z.enum(SEARCH_SORTS).optional(),
  ...passportFilterShape,
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const searchQuerySchema = searchFiltersSchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(24),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

const FILTER_KEYS = Object.keys(searchFiltersSchema.shape) as (keyof SearchFilters)[];

/** Serialize filters into URL params (stable order, drops empty values). */
export function filtersToParams(filters: Partial<SearchFilters>): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const v = filters[key];
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(key, v.join(','));
    } else p.set(key, String(v));
  }
  return p;
}

export function paramsToFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): SearchFilters {
  const obj: Record<string, string> = {};
  if (params instanceof URLSearchParams) params.forEach((v, k) => (obj[k] = v));
  else for (const [k, v] of Object.entries(params)) if (typeof v === 'string') obj[k] = v;
  const parsed = searchFiltersSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  // Drop invalid keys one by one rather than failing the whole search.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const shape = (searchFiltersSchema.shape as Record<string, z.ZodType>)[k];
    if (shape && shape.safeParse(v).success) clean[k] = v;
  }
  return searchFiltersSchema.parse(clean);
}

export const passportSchema = z.object({
  powerKw: z.number().min(0).max(10000).nullish(),
  threePhase: z.boolean().nullish(),
  ceilingM: z.number().min(1).max(50).nullish(),
  facadeM: z.number().min(0).max(500).nullish(),
  widthM: z.number().min(0).max(1000).nullish(),
  depthM: z.number().min(0).max(1000).nullish(),
  hasHood: z.boolean().nullish(),
  hasGas: z.boolean().nullish(),
  wetPoints: z.number().int().min(0).max(100).nullish(),
  gateWM: z.number().min(0).max(50).nullish(),
  truckAccess: z.boolean().nullish(),
  access247: z.boolean().nullish(),
  parking: z.number().int().min(0).max(5000).nullish(),
  shopWindow: z.boolean().nullish(),
  separateEntrance: z.boolean().nullish(),
  ventilation: z.boolean().nullish(),
  outline: z.array(z.tuple([z.number(), z.number()])).max(64).nullish(),
});
export type Passport = z.infer<typeof passportSchema>;

export const historyEntrySchema = z.object({
  id: z.string().uuid().optional(),
  businessName: z.string().trim().min(1).max(120),
  businessType: z.string().max(40).nullish(),
  startedAt: z.string().date(),
  endedAt: z.string().date().nullish(),
  note: z.string().max(500).nullish(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const equipmentItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(1000).default(1),
  priceMinor: z.number().int().min(0),
});

export const listingInputSchema = z.object({
  businessTypes: z.array(z.string().max(40)).min(1).max(5),
  dealType: z.enum(DEAL_TYPES),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(5000).default(''),
  descriptionEn: z.string().max(5000).nullish(),
  descriptionRu: z.string().max(5000).nullish(),
  address: z.string().trim().min(3).max(200),
  districtId: z.string().uuid().nullish(),
  city: z.string().default('tbilisi'),
  lat: z.number().min(41).max(43.7),
  lng: z.number().min(39.9).max(46.8),
  areaM2: z.number().positive().max(100_000),
  floor: z.number().int().min(-5).max(100).nullish(),
  floorsTotal: z.number().int().min(1).max(100).nullish(),
  priceMinor: z.number().int().positive(),
  currency: z.enum(['GEL', 'USD', 'EUR']).default('GEL'),
  priceHourMinor: z.number().int().positive().nullish(),
  priceDayMinor: z.number().int().positive().nullish(),
  serviceFeeMinor: z.number().int().min(0).default(0),
  depositMonths: z.number().min(0).max(12).default(1),
  utilitiesIncluded: z.boolean().default(false),
  isOwner: z.boolean().default(true),
  commissionPct: z.number().min(0).max(100).nullish(),
  projectId: z.string().uuid().nullish(),
  completionDate: z.string().date().nullish(),
  videoUrl: z.string().url().nullish(),
  tourUrl: z.string().url().nullish(),
  passport: passportSchema.default({}),
  history: z.array(historyEntrySchema).max(50).default([]),
  equipment: z.array(equipmentItemSchema).max(200).default([]),
  mediaIds: z.array(z.string().uuid()).max(40).default([]),
});
export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingUpdateSchema = listingInputSchema.partial();
export const listingStatusChangeSchema = z.object({
  status: z.enum(LISTING_STATUSES),
  reason: z.string().max(500).optional(),
});

export type MediaItem = {
  id: string;
  kind: 'photo' | 'video' | 'plan' | 'pano360' | 'document';
  url: string;
  variants?: Record<string, string> | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  isFloorplan?: boolean;
};

export type ListingCard = {
  id: string;
  slug: string;
  title: string;
  /** Per-locale title (Phase 22); UI falls back to `title` (ka) when empty. */
  titleEn?: string | null;
  titleRu?: string | null;
  dealType: DealType;
  status: ListingStatus;
  businessTypes: string[];
  priceMinor: number;
  currency: string;
  pricePeriod: 'month' | 'total' | 'day' | 'hour';
  areaM2: number;
  floor: number | null;
  address: string;
  districtName: string | null;
  districtSlug: string | null;
  districtNameEn?: string | null;
  districtNameRu?: string | null;
  lat: number | null;
  lng: number | null;
  isOwner: boolean;
  verifiedOwner: boolean;
  commissionPct: number | null;
  lastConfirmedAt: string | null;
  publishedAt: string | null;
  vip: boolean;
  offPlan: boolean;
  completionDate: string | null;
  cover: string | null;
  photosCount: number;
  locationScore: number | null;
  passport: Pick<Passport, 'widthM' | 'depthM' | 'ceilingM' | 'powerKw'>;
};

export type ListingDetail = ListingCard & {
  description: string;
  descriptionEn: string | null;
  descriptionRu: string | null;
  floorsTotal: number | null;
  priceHourMinor: number | null;
  priceDayMinor: number | null;
  serviceFeeMinor: number;
  depositMonths: number;
  utilitiesIncluded: boolean;
  equipmentPriceMinor: number | null;
  videoUrl: string | null;
  tourUrl: string | null;
  districtId: string | null;
  ownerId: string;
  orgId: string | null;
  projectId: string | null;
  passport: Passport;
  media: MediaItem[];
  history: (HistoryEntry & { id: string })[];
  equipment: { id: string; name: string; qty: number; priceMinor: number }[];
  closuresWarning: boolean;
  project: { id: string; name: string; slug: string; completionDate: string } | null;
  contact: { name: string; kind: 'owner' | 'broker'; orgName: string | null; orgSlug: string | null; brokerSlug: string | null; avatarUrl: string | null };
  districtAvgPriceM2Minor: number | null;
  createdAt: string;
  updatedAt: string;
};

/** ≥3 closures within the last 3 years flags the space (P10). */
export function hasFrequentClosures(history: Pick<HistoryEntry, 'endedAt'>[], now = new Date()): boolean {
  const since = new Date(now);
  since.setFullYear(since.getFullYear() - 3);
  return history.filter((h) => h.endedAt && new Date(h.endedAt) >= since).length >= 3;
}

/** Monthly cost calculator (P9). All amounts in minor units. */
export function estimateMonthlyCost(input: {
  rentMinor: number;
  areaM2: number;
  utilityCoef: number; // GEL per m²
  serviceFeeMinor: number;
  depositMonths: number;
  fitoutPerM2Minor: number;
  fitoutMonths?: number;
  utilitiesIncluded?: boolean;
}) {
  const utilities = input.utilitiesIncluded ? 0 : Math.round(input.areaM2 * input.utilityCoef * 100);
  const monthly = input.rentMinor + utilities + input.serviceFeeMinor;
  const deposit = Math.round(input.rentMinor * input.depositMonths);
  const fitout = Math.round(input.areaM2 * input.fitoutPerM2Minor);
  const months = input.fitoutMonths ?? 24;
  return {
    rentMinor: input.rentMinor,
    utilitiesMinor: utilities,
    serviceFeeMinor: input.serviceFeeMinor,
    monthlyMinor: monthly,
    depositMinor: deposit,
    fitoutMinor: fitout,
    fitoutMonthlyMinor: Math.round(fitout / months),
    firstMonthMinor: monthly + deposit + fitout,
    effectiveMonthlyMinor: monthly + Math.round(fitout / months),
  };
}

/** Price recommendation (P18): delta of listing price/m² vs district average. */
export function priceDelta(priceMinor: number, areaM2: number, districtAvgM2Minor: number | null | undefined) {
  if (!districtAvgM2Minor || areaM2 <= 0) return null;
  const perM2 = priceMinor / areaM2;
  const pct = Math.round(((perM2 - districtAvgM2Minor) / districtAvgM2Minor) * 100);
  return {
    perM2Minor: Math.round(perM2),
    districtAvgM2Minor,
    deltaPct: pct,
    verdict: pct > 10 ? ('above' as const) : pct < -10 ? ('below' as const) : ('fair' as const),
    recommendedMinor: Math.round(districtAvgM2Minor * areaM2),
  };
}
