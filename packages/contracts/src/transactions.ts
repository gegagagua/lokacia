/** Zod schemas & types owned by the transactions work stream (offers, viewings, chat, liveness, stats, AI describe). */
import { z } from 'zod';
import { counterOfferSchema, offerSchema, tenantProfileSchema } from './domain';

/* ---------------- offers (P16, P17, P20, P11) ---------------- */

export const OFFER_STATUSES = ['pending', 'countered', 'accepted', 'rejected', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const FITOUT_PAID_BY_LABELS_KA = { tenant: 'მოიჯარე', owner: 'მესაკუთრე', shared: 'თანაბრად' } as const;

/** Offer creation with an optional inline tenant-profile update (P20). */
export const offerCreateSchema = offerSchema.extend({ tenantProfile: tenantProfileSchema.nullish() });
export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export const offerCounterSchema = counterOfferSchema;
export const offerRejectSchema = z.object({ reason: z.string().trim().max(500).nullish() });
export const offersQuerySchema = z.object({ box: z.enum(['all', 'received', 'sent']).default('all') });

export type OfferPartyDto = { id: string; name: string | null; avatarUrl: string | null };
export type OfferDto = {
  id: string;
  listingId: string;
  rootOfferId: string;
  parentOfferId: string | null;
  fromUserId: string;
  toUserId: string;
  priceMinor: number;
  termMonths: number;
  freeMonths: number;
  indexationPct: number;
  fitoutPaidBy: 'tenant' | 'owner' | 'shared';
  equipmentIncluded: boolean;
  message: string | null;
  status: OfferStatus;
  contractUrl: string | null;
  createdAt: string;
};
export type OfferListingDto = {
  id: string;
  slug: string;
  title: string;
  address: string;
  dealType: string;
  priceMinor: number;
  pricePeriod: string;
  areaM2: number;
  cover: string | null;
  equipmentPriceMinor: number | null;
};
export type OfferThreadSummary = {
  rootId: string;
  latest: OfferDto;
  count: number;
  listing: OfferListingDto;
  counterpart: OfferPartyDto;
  direction: 'received' | 'sent';
  /** true when the latest offer waits for my answer */
  actionRequired: boolean;
};
export type OfferThread = {
  rootId: string;
  offers: OfferDto[];
  listing: OfferListingDto & { equipment: { name: string; qty: number; priceMinor: number }[] };
  tenant: OfferPartyDto;
  owner: OfferPartyDto;
  myRole: 'tenant' | 'owner';
  can: { counter: boolean; accept: boolean; reject: boolean; withdraw: boolean };
  contractUrl: string | null;
  status: OfferStatus;
};

/* ---------------- viewings & short-term bookings (P15, P21) ---------------- */

export const viewingCancelSchema = z.object({ reason: z.string().trim().max(500).nullish() });
export const viewingRescheduleSchema = z.object({ slotId: z.string().uuid() });
export const viewingsQuerySchema = z.object({
  role: z.enum(['all', 'visitor', 'host']).default('all'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['upcoming', 'past', 'all']).default('all'),
});
export const VIEWING_STATUS_LABELS_KA = { requested: 'მოთხოვნილი', confirmed: 'დადასტურებული', cancelled: 'გაუქმებული', done: 'ჩატარებული' } as const;
export const VIEWING_MODE_LABELS_KA = { onsite: 'ადგილზე', video: 'ვიდეოჩვენება' } as const;

export type ViewingDto = {
  id: string;
  listingId: string;
  slotId: string | null;
  kind: 'viewing' | 'short_term';
  startsAt: string;
  endsAt: string;
  mode: 'onsite' | 'video';
  status: 'requested' | 'confirmed' | 'cancelled' | 'done';
  videoUrl: string | null;
  note: string | null;
  priceMinor: number | null;
  myRole: 'visitor' | 'host';
  listing: { id: string; slug: string; title: string; address: string; cover: string | null };
  visitor: { id: string; name: string | null; phone: string | null };
  host: { id: string; name: string | null; phone: string | null };
  icsUrl: string;
};

/* ---------------- chat ---------------- */

export const messagesQuerySchema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });
export const conversationWithUserSchema = z.object({ listingId: z.string().uuid().nullish(), userId: z.string().uuid(), body: z.string().trim().min(1).max(4000) });

export type ConversationDto = {
  id: string;
  listing: { id: string; slug: string; title: string; cover: string | null } | null;
  other: { id: string; name: string | null; avatarUrl: string | null } | null;
  subject: string | null;
  lastMessage: { body: string; at: string; mine: boolean } | null;
  lastMessageAt: string | null;
  unread: number;
};
export type MessageDto = {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  attachments: { url: string; name: string; type: string }[];
  readAt: string | null;
  createdAt: string;
};

/* ---------------- liveness (P4) ---------------- */

export const livenessConfirmSchema = z.object({ token: z.string().min(10), answer: z.enum(['available', 'rented']).default('available') });
export type LivenessCheckInfo = {
  listing: { id: string; slug: string; title: string; address: string; status: string; cover: string | null; lastConfirmedAt: string | null };
  check: { sentAt: string; expiresAt: string; confirmedAt: string | null; result: 'pending' | 'confirmed' | 'rented' | 'expired' };
};

/* ---------------- stats & advice (P19, P18) ---------------- */

export const statsQuerySchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), 'days: 7, 30 ან 90').default(30) });
export type StatsPoint = { day: string; views: number; reveals: number; saves: number; shares: number };
export type StatsTotals = { views: number; reveals: number; saves: number; shares: number };
export type AdviceItem = { key: string; severity: 'high' | 'medium' | 'low'; messageKa: string; action?: { labelKa: string; href: string } };
export type ListingStatsDto = {
  listing: { id: string; slug: string; title: string; status: string; photosCount: number; lastConfirmedAt: string | null; publishedAt: string | null; priceMinor: number; areaM2: number };
  days: number;
  series: StatsPoint[];
  totals: StatsTotals;
  previousTotals: StatsTotals;
  /** average per listing in the same district & deal type over the same period */
  districtAvg: StatsTotals & { listings: number; districtName: string | null };
  revealRatePct: number | null;
  offers: number;
  viewings: number;
  price: { deltaPct: number; verdict: 'above' | 'below' | 'fair'; messageKa: string; recommendedMinor: number; districtAvgM2Minor: number; perM2Minor: number } | null;
  passportCompletenessPct: number;
  advice: AdviceItem[];
};

export type AccountSummaryDto = {
  listings: { total: number; byStatus: Record<string, number>; views30d: number; reveals30d: number; saves30d: number };
  pending: {
    unconfirmedListings: { id: string; slug: string; title: string; status: string; lastConfirmedAt: string | null }[];
    receivedOffers: number;
    sentOffers: number;
    offersAwaitingMe: number;
    upcomingViewings: { id: string; startsAt: string; title: string; myRole: 'visitor' | 'host'; mode: 'onsite' | 'video' }[];
    unreadMessages: number;
    rejectedListings: number;
    drafts: number;
  };
  tenant: { favorites: number; savedSearches: number; offersSent: number; hasTenantProfile: boolean };
};

/* ---------------- AI descriptions (C11 text part) ---------------- */

export const describeFactsSchema = z.object({
  title: z.string().max(200).default(''),
  businessTypes: z.array(z.string()).max(5).default([]),
  dealType: z.string().default('rent'),
  areaM2: z.number().positive().default(1),
  floor: z.number().int().nullish(),
  address: z.string().max(200).default(''),
  districtId: z.string().uuid().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  priceMinor: z.number().int().min(0).default(0),
  passport: z.record(z.string(), z.unknown()).default({}),
});
export type DescribeResponse = { ka: string; en: string; ru: string; source: 'ai' | 'template' };
