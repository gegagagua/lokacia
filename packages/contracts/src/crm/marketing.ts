import { z } from 'zod';
import type { ListingCard } from '../listings';
import type { ListingStatus } from '../taxonomy';

/** CRM contracts — listings & marketing (C9 publish/feed, C10 presentations, C12 profile, C13 owner reports, C14 liveness, C15 competitors). */

/* ---------- C9 org listings ---------- */
export type CrmListingRow = ListingCard & {
  agentId: string | null;
  agentName: string | null;
  rejectReason: string | null;
  stats30d: { views: number; reveals: number; saves: number };
  competitorTracks: number;
  coBrokerShares: number;
  updatedAt: string;
};

/* ---------- C10 presentations ---------- */
export const presentationCreateSchema = z.object({
  title: z.string().trim().min(2, 'სათაური ძალიან მოკლეია').max(160),
  message: z.string().max(2000).nullish(),
  contactId: z.string().uuid().nullish(),
  listingIds: z.array(z.string().uuid()).min(1, 'აირჩიეთ მინიმუმ ერთი ფართი').max(20, 'მაქსიმუმ 20 ფართი'),
});
export type PresentationCreate = z.infer<typeof presentationCreateSchema>;
export const presentationUpdateSchema = presentationCreateSchema.partial();

export type PresentationRow = {
  id: string;
  title: string;
  message: string | null;
  token: string;
  contactId: string | null;
  contactName: string | null;
  listingIds: string[];
  openedAt: string | null;
  openCount: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type PublicPresentationListing = ListingCard & {
  description: string;
  specs: { key: string; label: string; value: string }[];
  portalUrl: string;
};

export type PublicPresentation = {
  title: string;
  message: string | null;
  createdAt: string;
  org: { name: string; logoUrl: string | null; brandColor: string | null; phone: string | null; email: string | null; website: string | null };
  agent: { name: string | null; phone: string | null; avatarUrl: string | null } | null;
  contactName: string | null;
  listings: PublicPresentationListing[];
};

/* ---------- C12 broker profile ---------- */
export const brokerProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().max(2000).nullish(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'მინიმუმ 3 სიმბოლო')
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'მხოლოდ ლათინური ასოები, ციფრები და ტირე')
    .optional(),
  avatarUrl: z.string().max(500).nullish(),
});
export type BrokerProfileInput = z.infer<typeof brokerProfileSchema>;
export type BrokerProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  bio: string | null;
  slug: string | null;
  avatarUrl: string | null;
  publicUrl: string | null;
  listingsCount: number;
  reviews: { count: number; avg: number | null };
};

/* ---------- C13 owner reports ---------- */
export type OwnerReportRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug: string | null;
  weekStart: string;
  payload: { views: number; reveals: number; saves: number; viewings: number };
  sentAt: string | null;
  createdAt: string;
};

/* ---------- C14 liveness ---------- */
export const LIVENESS_STATES = ['ok', 'due', 'overdue', 'stale'] as const;
export type LivenessState = (typeof LIVENESS_STATES)[number];
export const LIVENESS_STATE_LABELS_KA: Record<LivenessState, string> = { ok: 'დადასტურებული', due: 'ვადა მოდის', overdue: 'ვადაგადაცილებული', stale: 'დამალული' };
export const livenessAskSchema = z.object({ listingIds: z.array(z.string().uuid()).min(1).max(200) });
export type CrmLivenessRow = {
  id: string;
  slug: string;
  title: string;
  address: string;
  status: ListingStatus;
  lastConfirmedAt: string | null;
  daysSince: number | null;
  state: LivenessState;
  lastCheck: { sentAt: string; expiresAt: string; result: string; channel: string } | null;
  ownerPhone: string | null;
};

/* ---------- C15 competitors ---------- */
export const competitorTrackSchema = z.object({
  listingId: z.string().uuid().nullish(),
  url: z.string().trim().url('ბმული არასწორია').max(1000),
  portal: z.string().max(60).optional(),
});
export type CompetitorTrackInput = z.infer<typeof competitorTrackSchema>;
export type CompetitorTrackRow = {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  listingPriceMinor: number | null;
  url: string;
  portal: string;
  lastPriceMinor: number | null;
  lastCheckedAt: string | null;
  status: 'active' | 'removed' | 'error';
  changesCount: number;
  createdAt: string;
};
export type CompetitorPriceChange = { id: string; oldPriceMinor: number | null; newPriceMinor: number; createdAt: string };

export function detectPortal(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('ss.ge')) return 'ss.ge';
    if (host.endsWith('myhome.ge')) return 'myhome.ge';
    return host;
  } catch {
    return 'other';
  }
}
