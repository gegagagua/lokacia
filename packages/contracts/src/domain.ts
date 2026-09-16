import { z } from 'zod';
import { phoneSchema, ROLES, ORG_ROLES, type Role, type OrgRole } from './common';
import { DEAL_TYPES } from './taxonomy';
import { searchFiltersSchema } from './listings';

/* ---------------- auth & users ---------------- */

export const otpRequestSchema = z.object({ phone: phoneSchema, turnstileToken: z.string().optional() });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'კოდი 6 ციფრისგან შედგება'),
  name: z.string().trim().max(80).optional(),
});

export type SessionUser = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  avatarUrl: string | null;
  locale: string;
  slug: string | null;
  orgs: { id: string; name: string; slug: string; type: 'agency' | 'developer'; role: OrgRole }[];
  impersonatorId?: string | null;
};

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().email().nullish(),
  avatarUrl: z.string().url().nullish(),
  bio: z.string().max(1000).nullish(),
  locale: z.enum(['ka', 'en', 'ru']).optional(),
  notificationPrefs: z.record(z.string(), z.array(z.string())).optional(),
});

export const tenantProfileSchema = z.object({
  activity: z.string().trim().max(200).nullish(),
  businessType: z.string().max(40).nullish(),
  companyName: z.string().trim().max(120).nullish(),
  experienceYears: z.number().int().min(0).max(80).nullish(),
  desiredTermMonths: z.number().int().min(1).max(240).nullish(),
  employees: z.number().int().min(0).max(100000).nullish(),
  website: z.string().url().nullish(),
  about: z.string().max(2000).nullish(),
});
export type TenantProfile = z.infer<typeof tenantProfileSchema>;

export const orgCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['agency', 'developer']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  about: z.string().max(2000).optional(),
});
export const orgInviteSchema = z.object({ phone: phoneSchema, role: z.enum(ORG_ROLES).default('agent') });
export const orgRoleChangeSchema = z.object({ role: z.enum(ORG_ROLES) });
export const userRoleSchema = z.enum(ROLES);

/* ---------------- engagement ---------------- */

export const NOTIFY_CHANNELS = ['email', 'sms', 'telegram', 'viber', 'in_app'] as const;

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  query: searchFiltersSchema,
  channels: z.array(z.enum(NOTIFY_CHANNELS)).min(1).default(['in_app']),
});

export const demandSchema = z.object({
  businessType: z.string().max(40),
  dealType: z.enum(DEAL_TYPES).default('rent'),
  title: z.string().trim().min(5).max(140),
  description: z.string().max(2000).nullish(),
  areaMin: z.number().int().min(1).nullish(),
  areaMax: z.number().int().min(1).nullish(),
  budgetMinor: z.number().int().min(0).nullish(),
  districtIds: z.array(z.string().uuid()).max(20).default([]),
  contactPhone: z.string().nullish(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

export const compareSchema = z.object({
  name: z.string().trim().max(120).optional(),
  listingIds: z.array(z.string().uuid()).max(6, 'შედარება — მაქსიმუმ 6 ფართი'),
});

/* ---------------- transactions ---------------- */

export const offerSchema = z.object({
  listingId: z.string().uuid(),
  priceMinor: z.number().int().positive(),
  termMonths: z.number().int().min(1).max(360),
  freeMonths: z.number().int().min(0).max(24).default(0),
  indexationPct: z.number().int().min(0).max(30).default(0),
  fitoutPaidBy: z.enum(['tenant', 'owner', 'shared']).default('tenant'),
  equipmentIncluded: z.boolean().default(false),
  message: z.string().max(2000).nullish(),
});
export const counterOfferSchema = offerSchema.omit({ listingId: true });
export const OFFER_STATUS_LABELS_KA = {
  pending: 'ლოდინში',
  countered: 'კონტრ-შეთავაზება',
  accepted: 'მიღებული',
  rejected: 'უარყოფილი',
  withdrawn: 'გაუქმებული',
} as const;

export const viewingBookSchema = z.object({
  listingId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  mode: z.enum(['onsite', 'video']).default('onsite'),
  note: z.string().max(1000).nullish(),
});

export const slotsCreateSchema = z.object({
  kind: z.enum(['viewing', 'short_term']),
  slots: z
    .array(
      z.object({
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }),
        priceMinor: z.number().int().min(0).nullish(),
      }),
    )
    .min(1)
    .max(200),
});

export const messageSendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z.array(z.object({ url: z.string(), name: z.string(), type: z.string() })).max(10).optional(),
});
export const conversationStartSchema = z.object({ listingId: z.string().uuid(), body: z.string().trim().min(1).max(4000) });

/* ---------------- AI ---------------- */

export const searchParseRequestSchema = z.object({ text: z.string().trim().min(2).max(300) });
export const searchParseResponseSchema = z.object({
  filters: searchFiltersSchema,
  source: z.enum(['ai', 'rules', 'cache', 'fallback']),
});
export type SearchParseResponse = z.infer<typeof searchParseResponseSchema>;

export const describeRequestSchema = z.object({
  listingId: z.string().uuid().optional(),
  facts: z.record(z.string(), z.unknown()).optional(),
  locales: z.array(z.enum(['ka', 'en', 'ru'])).default(['ka', 'en', 'ru']),
});

/* ---------------- services marketplace ---------------- */

export const quoteRequestSchema = z.object({
  providerId: z.string().uuid(),
  category: z.string().max(40),
  description: z.string().trim().min(10).max(3000),
  listingId: z.string().uuid().nullish(),
});
export const quoteSchema = z.object({ quoteMinor: z.number().int().positive(), quoteNote: z.string().max(2000).nullish() });

/* ---------------- CRM ---------------- */

export const contactRequirementsSchema = z.object({
  businessType: z.string().optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
  areaMin: z.number().optional(),
  areaMax: z.number().optional(),
  budgetMaxMinor: z.number().int().optional(),
  districtIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(2000).optional(),
});

export const contactSchema = z.object({
  type: z.enum(['client', 'owner', 'partner']).default('client'),
  name: z.string().trim().min(1).max(160),
  company: z.string().max(160).nullish(),
  phones: z.array(z.string()).max(10).default([]),
  emails: z.array(z.string().email()).max(10).default([]),
  tags: z.array(z.string().max(40)).max(30).default([]),
  source: z.string().max(60).nullish(),
  requirements: contactRequirementsSchema.nullish(),
  ownerAgentId: z.string().uuid().nullish(),
  notes: z.string().max(5000).nullish(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const dealSchema = z.object({
  contactId: z.string().uuid(),
  listingId: z.string().uuid().nullish(),
  pipelineId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  stage: z.string().optional(),
  valueMinor: z.number().int().min(0).default(0),
  commissionPct: z.number().min(0).max(100).default(10),
  agentId: z.string().uuid().nullish(),
  agentSharePct: z.number().min(0).max(100).default(50),
  source: z.string().max(60).nullish(),
  expectedCloseAt: z.string().datetime({ offset: true }).nullish(),
});
export const dealMoveSchema = z.object({
  stage: z.string(),
  position: z.number().int().min(0).default(0),
  lostReason: z.string().max(500).optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  dealId: z.string().uuid().nullish(),
  contactId: z.string().uuid().nullish(),
  assigneeId: z.string().uuid().nullish(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

/** Commission calculator (C18). */
export function dealFinance(valueMinor: number, commissionPct: number, agentSharePct: number) {
  const commission = Math.round((valueMinor * commissionPct) / 100);
  const agent = Math.round((commission * agentSharePct) / 100);
  return { commissionMinor: commission, agentMinor: agent, agencyMinor: commission - agent };
}

/* ---------------- billing ---------------- */

export const checkoutSchema = z.object({
  planKey: z.string(),
  orgId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  businessType: z.string().optional(),
  seats: z.number().int().min(1).max(500).default(1),
  provider: z.enum(['mock', 'bog', 'tbc', 'psp']).optional(),
});
