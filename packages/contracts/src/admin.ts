/** Zod schemas & types owned by the admin work stream (Phase 4, Phase 15 feedback/analytics). */
import { z } from 'zod';
import { ROLES, type Role } from './common';
import type { ListingDetail } from './listings';
import type { ListingStatus } from './taxonomy';

/* ---------------- moderation ---------------- */

/** Reject reason templates shown in the moderation queue. */
export const REJECT_REASON_TEMPLATES_KA = [
  'ფოტოები არ შეესაბამება ფართს ან დაბალი ხარისტისაა',
  'ფასი ან ფართობი არარეალისტურია',
  'მისამართი ან ლოკაცია რუკაზე არასწორია',
  'ტექნიკური პასპორტი არასრულია',
  'განცხადება დუბლიკატია',
  'ტექსტი შეიცავს საკონტაქტო ინფორმაციას ან რეკლამას',
  'ფართი არ არის კომერციული',
] as const;

export const moderationDecisionSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const moderationBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
});
export type ModerationBulkInput = z.infer<typeof moderationBulkSchema>;

export type ModerationQueueItem = {
  id: string;
  slug: string;
  title: string;
  dealType: string;
  businessTypes: string[];
  priceMinor: number;
  areaM2: number;
  address: string;
  city: string;
  districtName: string | null;
  cover: string | null;
  photosCount: number;
  owner: { id: string; name: string | null; phone: string | null };
  orgName: string | null;
  submittedAt: string;
  /** Price per m² vs district average, % (positive = above). */
  priceDeltaPct: number | null;
};

export type AuditEntryDto = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  impersonatorId: string | null;
  orgId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  createdAt: string;
};

export type ModerationDetail = {
  listing: ListingDetail;
  owner: { id: string; name: string | null; phone: string | null; createdAt: string; listingsCount: number; rejectedCount: number; bannedAt: string | null };
  priceCheck: { districtAvgM2Minor: number | null; priceM2Minor: number; deltaPct: number | null; verdict: 'above' | 'below' | 'fair' | null };
  verification: VerificationDto | null;
  audit: AuditEntryDto[];
};

export type VerificationDto = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  documentUrl: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
  listing: { id: string; slug: string; title: string; address: string; cover: string | null };
  user: { id: string; name: string | null; phone: string | null };
};

/* ---------------- users & orgs ---------------- */

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  banned: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const adminRoleSchema = z.object({ role: z.enum(ROLES) });
export const adminBanSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export type AdminUserRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  listingsCount: number;
};

export type AdminUserDetail = AdminUserRow & {
  orgs: { id: string; name: string; slug: string; role: string }[];
  activeSessions: number;
  verifiedAt: string | null;
  listings: { id: string; slug: string; title: string; status: ListingStatus }[];
  subscriptions: { id: string; planKey: string; status: string; periodEnd: string | null }[];
  audit: AuditEntryDto[];
};

export const adminOrgsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['agency', 'developer']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const adminOrgUpdateSchema = z.object({ verified: z.boolean().optional(), plan: z.string().max(40).optional() });

export type AdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  type: 'agency' | 'developer';
  plan: string;
  verified: boolean;
  membersCount: number;
  listingsCount: number;
  createdAt: string;
};
export type AdminOrgDetail = AdminOrgRow & {
  phone: string | null;
  email: string | null;
  members: { id: string; userId: string | null; name: string | null; phone: string | null; role: string; active: boolean }[];
  subscriptions: { id: string; planKey: string; status: string; seats: number; periodEnd: string | null }[];
};

/* ---------------- settings & plans ---------------- */

/** Editable runtime settings (value type + Georgian label). */
export const ADMIN_SETTINGS = {
  launch_promo_until: { kind: 'date', labelKa: 'პრომო-პერიოდი (ყველაფერი უფასო) — ბოლო დღე' },
  liveness_interval_days: { kind: 'number', labelKa: 'აქტუალობის დადასტურების ინტერვალი, დღე' },
  liveness_grace_hours: { kind: 'number', labelKa: 'დადასტურების ვადა დამალვამდე, საათი' },
  billing_grace_hours: { kind: 'number', labelKa: 'გამოწერის საშეღავათო პერიოდი, საათი' },
  demand_expiry_days: { kind: 'number', labelKa: 'მოთხოვნის ვადა, დღე' },
  reveal_rate_limit_per_hour: { kind: 'number', labelKa: 'ნომრის ჩვენების ლიმიტი საათში' },
  services_commission_pct: { kind: 'number', labelKa: 'მომსახურებების კომისია, %' },
  transfer_commission_pct: { kind: 'number', labelKa: 'ბიზნესის გადაცემის კომისია, %' },
  finance_default_commission_pct: { kind: 'number', labelKa: 'ფინანსური პარტნიორის ნაგულისხმევი კომისია, %' },
  vat_pct: { kind: 'number', labelKa: 'დღგ, %' },
} as const;
export type AdminSettingKey = keyof typeof ADMIN_SETTINGS;

export const adminSettingsUpdateSchema = z.object({
  launch_promo_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  liveness_interval_days: z.number().int().min(1).max(90).optional(),
  liveness_grace_hours: z.number().int().min(1).max(720).optional(),
  billing_grace_hours: z.number().int().min(0).max(2160).optional(),
  demand_expiry_days: z.number().int().min(1).max(365).optional(),
  reveal_rate_limit_per_hour: z.number().int().min(1).max(1000).optional(),
  services_commission_pct: z.number().min(0).max(100).optional(),
  transfer_commission_pct: z.number().min(0).max(100).optional(),
  finance_default_commission_pct: z.number().min(0).max(100).optional(),
  vat_pct: z.number().min(0).max(100).optional(),
});

export const planUpdateSchema = z.object({
  nameKa: z.string().trim().min(2).max(120).optional(),
  priceMinor: z.number().int().min(0).max(100_000_000).optional(),
  days: z.number().int().min(1).max(3650).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  limits: z.record(z.string(), z.number()).optional(),
  active: z.boolean().optional(),
  sort: z.number().int().optional(),
});

/* ---------------- CMS ---------------- */

export const cmsPageSchema = z.object({
  kind: z.enum(['permits', 'static']),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, 'მხოლოდ ლათინური ასოები, ციფრები და ტირე'),
  businessTypeId: z.string().uuid().nullish(),
  locale: z.enum(['ka', 'en', 'ru']).default('ka'),
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().max(100_000),
  published: z.boolean().default(true),
});
export type CmsPageInput = z.infer<typeof cmsPageSchema>;
export type CmsPageDto = CmsPageInput & { id: string; createdAt: string; updatedAt: string };

/* ---------------- taxonomy ---------------- */

export const filterDefSchema = z.object({
  key: z.string().min(1).max(40),
  kind: z.enum(['boolean', 'range', 'min']),
  labelKa: z.string().min(1).max(80),
  labelEn: z.string().max(80).optional(),
  labelRu: z.string().max(80).optional(),
  unit: z.string().max(10).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});
export const businessTypeSchema = z.object({
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  nameKa: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  nameRu: z.string().trim().min(2).max(80),
  icon: z.string().trim().min(1).max(40).default('store'),
  utilityCoef: z.number().min(0).max(1000),
  fitoutPerM2Minor: z.number().int().min(0).max(100_000_000),
  sort: z.number().int().default(0),
  filterConfig: z.object({ filters: z.array(filterDefSchema).max(30), required: z.array(z.string()).max(30) }),
});
export type BusinessTypeInput = z.infer<typeof businessTypeSchema>;
export const districtOverrideSchema = z.object({ avgPriceM2OverrideMinor: z.number().int().min(0).max(100_000_000).nullable() });

/* ---------------- audit, feedback, analytics ---------------- */

export const auditQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  entity: z.string().max(60).optional(),
  entityId: z.string().max(80).optional(),
  action: z.string().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const feedbackSchema = z.object({
  message: z.string().trim().min(3, 'შეტყობინება ძალიან მოკლეია').max(4000),
  rating: z.number().int().min(1).max(5).optional(),
  path: z.string().max(500).optional(),
  app: z.enum(['web', 'crm', 'admin']).default('web'),
});
export const feedbackStatusSchema = z.object({ status: z.enum(['new', 'seen', 'done']) });
export type FeedbackDto = { id: string; userId: string | null; userName: string | null; app: string; path: string | null; rating: number | null; message: string; status: 'new' | 'seen' | 'done'; createdAt: string };

export const analyticsEventSchema = z.object({
  name: z.string().trim().min(1).max(60).regex(/^[a-z0-9_.:-]+$/i),
  path: z.string().max(500).optional(),
  props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
});

export type AdminDashboard = {
  listingsByStatus: Record<string, number>;
  newUsers7d: number;
  newUsers30d: number;
  usersTotal: number;
  revenue30dMinor: number;
  mrrMinor: number;
  queues: { moderation: number; verifications: number; feedback: number; disputes: number; failedPayments: number };
  signupsByDay: { day: string; count: number }[];
  events7d: { name: string; count: number }[];
};

export type AdminRevenue = {
  mrrMinor: number;
  revenue30dMinor: number;
  byMonth: { month: string; amountMinor: number }[];
  byProduct: { purpose: string; amountMinor: number; count: number }[];
  subscriptionsByStatus: Record<string, number>;
  failedPayments: { id: string; invoiceNumber: string; amountMinor: number; provider: string; attempts: number; createdAt: string; payer: string | null }[];
  financeCommissionMinor: number;
};

export const escrowResolveSchema = z.object({ outcome: z.enum(['release', 'refund']), note: z.string().trim().min(3).max(1000) });

export const financeProductSchema = z.object({
  partner: z.string().trim().min(2).max(120),
  kind: z.enum(['fitout_loan', 'leasing', 'insurance']),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(4000),
  rateText: z.string().trim().max(120).nullish(),
  minAmountMinor: z.number().int().min(0).nullish(),
  maxAmountMinor: z.number().int().min(0).nullish(),
  commissionPct: z.number().min(0).max(100),
  active: z.boolean().default(true),
});
export type FinanceProductInput = z.infer<typeof financeProductSchema>;
export const financeSimulateSchema = z.object({ status: z.enum(['approved', 'rejected']), approvedAmountMinor: z.number().int().min(0).optional() });
