/** Zod schemas & types owned by the portal work stream (discovery, alerts, favorites, demand, services, projects, profiles, SEO). */
import { z } from 'zod';
import { DEAL_TYPES, type DealType } from './taxonomy';
import { searchFiltersSchema, type ListingCard, type Passport, type SearchFilters } from './listings';
import { NOTIFY_CHANNELS } from './domain';

/* ---------------- saved searches & alerts (P7) ---------------- */

export const ALERT_CHANNELS = ['in_app', 'email', 'telegram', 'viber'] as const satisfies readonly (typeof NOTIFY_CHANNELS)[number][];
export type AlertChannel = (typeof ALERT_CHANNELS)[number];
export const ALERT_CHANNEL_LABELS_KA: Record<AlertChannel, string> = {
  in_app: 'საიტზე',
  email: 'ელ. ფოსტა',
  telegram: 'Telegram',
  viber: 'Viber',
};

export const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  query: searchFiltersSchema,
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1, 'აირჩიეთ მინიმუმ ერთი არხი').default(['in_app']),
});
export const savedSearchUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1).optional(),
  active: z.boolean().optional(),
});
export const unsubscribeSchema = z.object({ token: z.string().min(10).max(200) });

export type SavedSearchDto = {
  id: string;
  name: string;
  query: SearchFilters;
  channels: AlertChannel[];
  active: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  /** Active listings matching right now. */
  matchCount: number;
  /** Matching listings published since last notification (or last 7 days). */
  newCount: number;
};

/** Human summary of filters for alert names ("კაფე · ვაკე · 3 000 ₾-მდე"). */
export function describeFilters(
  f: Partial<SearchFilters>,
  names: { businessType?: (slug: string) => string | undefined; district?: (slug: string) => string | undefined } = {},
): string {
  const parts: string[] = [];
  if (f.businessType) parts.push(names.businessType?.(f.businessType) ?? f.businessType);
  if (f.dealType) parts.push({ rent: 'იჯარა', sale: 'იყიდება', transfer: 'ბიზნესის გადაცემა', short_term: 'ხანმოკლე იჯარა' }[f.dealType]);
  if (f.districts?.length) parts.push(f.districts.map((d) => names.district?.(d) ?? d).join(', '));
  if (f.areaMin != null || f.areaMax != null) parts.push(`${f.areaMin ?? 0}–${f.areaMax ?? '∞'} მ²`);
  if (f.priceMax != null) parts.push(`${String(f.priceMax).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₾-მდე`);
  else if (f.priceMin != null) parts.push(`${String(f.priceMin).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₾-დან`);
  if (f.onlyOwners) parts.push('მესაკუთრისგან');
  if (f.q) parts.push(`„${f.q}“`);
  return parts.join(' · ') || 'ყველა ფართი';
}

/* ---------------- favorites & comparison (P14) ---------------- */

export const favoriteAddSchema = z.object({ listingId: z.string().uuid(), note: z.string().max(500).nullish() });
export const compareCreateSchema = z.object({
  name: z.string().trim().min(1).max(120).default('შედარება'),
  listingIds: z.array(z.string().uuid()).min(1, 'აირჩიეთ მინიმუმ ერთი ფართი').max(6, 'შედარება — მაქსიმუმ 6 ფართი'),
});
export const compareUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  listingIds: z.array(z.string().uuid()).max(6, 'შედარება — მაქსიმუმ 6 ფართი').optional(),
});
export const COMPARE_MAX = 6;

export type FavoriteDto = ListingCard & { favoritedAt: string; note: string | null };

export type CompareListingDto = ListingCard & {
  passportFull: Passport;
  serviceFeeMinor: number;
  depositMonths: number;
  utilitiesIncluded: boolean;
  pricePerM2Minor: number | null;
  districtAvgPriceM2Minor: number | null;
};
export type CompareListDto = { id: string; name: string; shareToken: string; listingIds: string[]; createdAt: string; updatedAt: string };
export type CompareSharedDto = { name: string; listings: CompareListingDto[]; updatedAt: string };

/* ---------------- demand board (P6) ---------------- */

export const demandCreateSchema = z
  .object({
    businessType: z.string().min(1).max(40),
    dealType: z.enum(DEAL_TYPES).default('rent'),
    title: z.string().trim().min(5, 'სათაური — მინიმუმ 5 სიმბოლო').max(140),
    description: z.string().trim().max(2000).nullish(),
    areaMin: z.number().int().min(1).nullish(),
    areaMax: z.number().int().min(1).nullish(),
    budgetMinor: z.number().int().min(0).nullish(),
    districtIds: z.array(z.string().uuid()).max(20).default([]),
    contactPhone: z.string().max(30).nullish(),
    expiresInDays: z.number().int().min(1).max(90).optional(),
  })
  .refine((v) => v.areaMin == null || v.areaMax == null || v.areaMax >= v.areaMin, { message: 'მაქსიმალური ფართი ნაკლებია მინიმალურზე', path: ['areaMax'] });

export const demandListQuerySchema = z.object({
  businessType: z.string().max(40).optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
  districtId: z.string().uuid().optional(),
  areaMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(), // whole GEL
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(20),
});
export type DemandListQuery = z.infer<typeof demandListQuerySchema>;

export const demandContactSchema = z.object({
  body: z.string().trim().min(5, 'შეტყობინება — მინიმუმ 5 სიმბოლო').max(2000),
  listingId: z.string().uuid().nullish(),
});

export type DemandStatus = 'active' | 'closed' | 'expired';
export type DemandDto = {
  id: string;
  title: string;
  description: string | null;
  businessType: string;
  businessTypeName: string;
  dealType: DealType;
  areaMin: number | null;
  areaMax: number | null;
  budgetMinor: number | null;
  districts: { id: string; slug: string; name: string }[];
  status: DemandStatus;
  expiresAt: string;
  createdAt: string;
  requester: { name: string; companyName: string | null; activity: string | null };
  mine: boolean;
  contactsCount: number;
};

/** Search filters that replay a demand request (P6 suggested matches). */
export function demandToFilters(d: Pick<DemandDto, 'businessType' | 'dealType' | 'areaMin' | 'areaMax' | 'budgetMinor'> & { districtSlugs: string[] }): SearchFilters {
  return {
    businessType: d.businessType,
    dealType: d.dealType,
    areaMin: d.areaMin ?? undefined,
    areaMax: d.areaMax ?? undefined,
    priceMax: d.budgetMinor ? Math.round(d.budgetMinor / 100) : undefined,
    districts: d.districtSlugs.length ? d.districtSlugs : undefined,
  } as SearchFilters;
}

/* ---------------- services marketplace (P24) ---------------- */

export const SERVICE_ORDER_STATUSES = ['requested', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled'] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];
export const SERVICE_ORDER_STATUS_LABELS_KA: Record<ServiceOrderStatus, string> = {
  requested: 'ახალი მოთხოვნა',
  quoted: 'ფასი შეთავაზებულია',
  accepted: 'მიღებული',
  in_progress: 'სრულდება',
  completed: 'დასრულებული',
  cancelled: 'გაუქმებული',
};
/** Who may move an order where (provider vs requester). */
export const SERVICE_ORDER_TRANSITIONS: Record<ServiceOrderStatus, { to: ServiceOrderStatus; by: 'provider' | 'requester' | 'both' }[]> = {
  requested: [
    { to: 'quoted', by: 'provider' },
    { to: 'cancelled', by: 'both' },
  ],
  quoted: [
    { to: 'quoted', by: 'provider' },
    { to: 'accepted', by: 'requester' },
    { to: 'cancelled', by: 'both' },
  ],
  accepted: [
    { to: 'in_progress', by: 'provider' },
    { to: 'completed', by: 'provider' },
    { to: 'cancelled', by: 'both' },
  ],
  in_progress: [
    { to: 'completed', by: 'provider' },
    { to: 'cancelled', by: 'both' },
  ],
  completed: [],
  cancelled: [],
};

export const providerListQuerySchema = z.object({
  category: z.string().max(40).optional(),
  city: z.string().max(40).optional(),
  q: z.string().trim().max(100).optional(),
  verified: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export const serviceQuoteRequestSchema = z.object({
  providerId: z.string().uuid(),
  category: z.string().min(1).max(40),
  description: z.string().trim().min(10, 'აღწერეთ დეტალურად — მინიმუმ 10 სიმბოლო').max(3000),
  listingId: z.string().uuid().nullish(),
});
export const serviceQuoteSchema = z.object({ quoteMinor: z.number().int().positive(), quoteNote: z.string().trim().max(2000).nullish() });
export const serviceOrderStatusSchema = z.object({ status: z.enum(['in_progress', 'completed', 'cancelled']) });
export const reviewCreateSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).nullish() });

export type ProviderDto = {
  id: string;
  slug: string;
  name: string;
  categories: string[];
  about: string | null;
  logoUrl: string | null;
  city: string;
  priceFrom: string | null;
  rating: number; // 0..5, one decimal
  reviewsCount: number;
  verified: boolean;
  portfolio: string[];
  completedOrders: number;
};
export type ReviewDto = { id: string; authorName: string; rating: number; body: string | null; createdAt: string };
export type ProviderDetailDto = ProviderDto & { reviews: ReviewDto[]; phone: string | null; isMine: boolean };
export type ServiceOrderDto = {
  id: string;
  provider: { id: string; slug: string; name: string };
  requester: { id: string; name: string };
  listing: { id: string; slug: string; title: string } | null;
  category: string;
  description: string;
  status: ServiceOrderStatus;
  quoteMinor: number | null;
  quoteNote: string | null;
  amountMinor: number | null;
  commissionPct: number;
  commissionMinor: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: 'provider' | 'requester';
  canReview: boolean;
};

/* ---------------- off-plan projects (P8) ---------------- */

export const prebookSchema = z.object({
  listingId: z.string().uuid().nullish(),
  message: z.string().trim().max(1000).nullish(),
  phone: z.string().trim().max(30).nullish(),
});
export type ProjectDto = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string | null;
  district: { slug: string; name: string } | null;
  completionDate: string;
  description: string | null;
  floors: number | null;
  coverUrl: string | null;
  lat: number | null;
  lng: number | null;
  developer: { name: string; slug: string; logoUrl: string | null; verified: boolean };
  unitsCount: number;
  minPriceMinor: number | null;
  minAreaM2: number | null;
  maxAreaM2: number | null;
};
export type ProjectDetailDto = ProjectDto & { units: ListingCard[]; prebookingsCount: number };

/* ---------------- public profiles (C12) ---------------- */

export type BrokerProfileDto = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  memberSince: string;
  org: { name: string; slug: string; logoUrl: string | null; verified: boolean } | null;
  rating: number | null;
  reviewsCount: number;
  reviews: ReviewDto[];
  listings: ListingCard[];
  stats: { active: number; closed: number; districts: string[] };
};
export type AgencyProfileDto = {
  id: string;
  slug: string;
  name: string;
  type: 'agency' | 'developer';
  about: string | null;
  logoUrl: string | null;
  address: string | null;
  website: string | null;
  verified: boolean;
  memberSince: string;
  rating: number | null;
  reviewsCount: number;
  reviews: ReviewDto[];
  team: { id: string; name: string; slug: string | null; avatarUrl: string | null; role: string; activeListings: number }[];
  listings: ListingCard[];
  projects: { slug: string; name: string; completionDate: string }[];
  stats: { active: number; closed: number };
};

/* ---------------- SEO landings & stats ---------------- */

export type LandingDto = {
  businessType: { slug: string; name: string } | null;
  district: { slug: string; name: string; city: string } | null;
  total: number;
  byDealType: Partial<Record<DealType, number>>;
  avgPriceM2Minor: number | null;
  minPriceMinor: number | null;
  medianAreaM2: number | null;
  ownersShare: number; // 0..100
  listings: ListingCard[];
  /** Links to sibling landings with counts (districts for a type, types for a district). */
  related: { kind: 'district' | 'businessType'; slug: string; name: string; count: number }[];
};
export type SiteStatsDto = {
  activeListings: number;
  confirmedLast14d: number;
  verifiedOwners: number;
  brokers: number;
  agencies: number;
  activeDemand: number;
  providers: number;
  projects: number;
  newThisWeek: number;
};
export type SitemapListingDto = { slug: string; updatedAt: string };
