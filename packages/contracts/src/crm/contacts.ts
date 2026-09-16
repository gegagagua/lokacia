/** CRM contracts — contacts, duplicates, matching, client portal (C1, C2, C8). */
import { z } from 'zod';

export const CONTACT_TYPES = ['client', 'owner', 'partner'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_TYPE_LABELS_KA: Record<ContactType, string> = { client: 'კლიენტი', owner: 'მესაკუთრე', partner: 'პარტნიორი' };

export const contactListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(CONTACT_TYPES).optional(),
  tag: z.string().max(40).optional(),
  source: z.string().max(60).optional(),
  agentId: z.string().uuid().optional(),
  hasRequirements: z.preprocess((v) => v === 'true' || v === true || v === '1', z.boolean()).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

export type ContactRow = {
  id: string;
  type: ContactType;
  name: string;
  company: string | null;
  phones: string[];
  emails: string[];
  tags: string[];
  source: string | null;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  hasRequirements: boolean;
  lastContactedAt: string | null;
  createdAt: string;
};

export const contactMergeSchema = z.object({
  targetId: z.string().uuid(),
  sourceIds: z.array(z.string().uuid()).min(1).max(20),
});
export type ContactMerge = z.infer<typeof contactMergeSchema>;

export type DuplicateCluster = {
  key: string;
  reasons: ('phone' | 'name')[];
  contacts: (ContactRow & { similarity: number })[];
};

export const MATCH_STATUSES = ['new', 'sent', 'liked', 'disliked', 'dismissed'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export const MATCH_STATUS_LABELS_KA: Record<MatchStatus, string> = { new: 'ახალი', sent: 'გაგზავნილი', liked: 'მოეწონა', disliked: 'არ მოეწონა', dismissed: 'უარყოფილი' };

export const matchStatusSchema = z.object({ status: z.enum(['new', 'dismissed']) });
export const portalSendSchema = z.object({ matchIds: z.array(z.string().uuid()).min(1).max(50) });
export const portalReactionSchema = z.object({
  reaction: z.enum(['liked', 'disliked']),
  comment: z.string().trim().max(1000).nullish(),
});

export type RequirementsLike = {
  businessType?: string;
  dealType?: string;
  areaMin?: number;
  areaMax?: number;
  budgetMaxMinor?: number;
  districtIds?: string[];
};
export type ListingLike = { businessTypes: string[]; dealType: string; areaM2: number; priceMinor: number; districtId: string | null };

/**
 * Requirement ↔ listing score 0–100 (C2). Hard filters return 0: business type / deal type mismatch,
 * area outside ±10 %, price > budget +10 %, district not in the wanted list.
 */
export function matchScore(req: RequirementsLike, l: ListingLike): number {
  let score = 100;
  let criteria = 0;
  if (req.businessType) {
    criteria++;
    if (!l.businessTypes.includes(req.businessType)) return 0;
  }
  if (req.dealType) {
    criteria++;
    if (req.dealType !== l.dealType) return 0;
  }
  if (req.areaMin != null || req.areaMax != null) {
    criteria++;
    const min = req.areaMin ?? 0;
    const max = req.areaMax ?? Number.POSITIVE_INFINITY;
    if (l.areaM2 < min * 0.9 || l.areaM2 > max * 1.1) return 0;
    if (l.areaM2 < min || l.areaM2 > max) score -= 15;
  }
  if (req.budgetMaxMinor != null && req.budgetMaxMinor > 0) {
    criteria++;
    if (l.priceMinor > req.budgetMaxMinor * 1.1) return 0;
    if (l.priceMinor > req.budgetMaxMinor) score -= 20;
    else if (l.priceMinor < req.budgetMaxMinor * 0.5) score -= 5;
  }
  if (req.districtIds?.length) {
    criteria++;
    if (!l.districtId || !req.districtIds.includes(l.districtId)) return 0;
  }
  if (criteria < 2) return 0; // too vague to notify anybody
  return Math.max(0, Math.min(100, score));
}

export const MATCH_THRESHOLD = 60;

export type PortalView = {
  org: { name: string; logoUrl: string | null; brandColor: string | null; phone: string | null };
  contact: { firstName: string };
  agent: { name: string | null; phone: string | null } | null;
  items: {
    matchId: string;
    status: MatchStatus;
    comment: string | null;
    listing: { id: string; slug: string; title: string; address: string; priceMinor: number; pricePeriod: string; areaM2: number; dealType: string; cover: string | null; districtName: string | null };
  }[];
};
