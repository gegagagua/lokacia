/** Zod schemas & types owned by the v2 work stream (V1–V6, V8–V10). */
import { z } from 'zod';

/* ---------------- V1 traffic & V2 location score ---------------- */

export type TrafficResponse = {
  listingId: string;
  source: 'samples' | 'provider';
  provider: string;
  /** weekday 0 = Sunday … 6 = Saturday; hours[0..23] = people per hour. */
  days: { weekday: number; hours: number[]; total: number }[];
  peak: { weekday: number; hour: number; count: number };
  avgDailyTotal: number;
};

export type ScoreComponent = { key: string; label: string; value: number; weight: number };
export type ScoreResponse = {
  listingId: string;
  businessType: string;
  score: number;
  components: ScoreComponent[];
  summary: string;
  computedAt: string;
};

/* ---------------- V5 scans ---------------- */

export const SCAN_FORMATS = ['glb', 'gltf', 'obj', 'usdz', 'ply'] as const;
export type ScanFormat = (typeof SCAN_FORMATS)[number];
export const scanCreateSchema = z.object({ mediaId: z.string().uuid(), format: z.enum(SCAN_FORMATS).optional() });
export type ScanPlan = { outline: [number, number][]; widthM: number; depthM: number; areaM2: number };
export type ScanDto = { id: string; listingId: string; format: ScanFormat; url: string; status: 'processing' | 'ready' | 'failed'; plan: ScanPlan | null; createdAt: string };

/* ---------------- V3 escrow ---------------- */

export const ESCROW_STATUSES = ['pending', 'funded', 'released', 'refunded', 'disputed'] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];
export const ESCROW_STATUS_LABELS_KA: Record<EscrowStatus, string> = {
  pending: 'ხელმოწერა და ჩარიცხვა',
  funded: 'დეპოზიტი ჩარიცხულია',
  released: 'გადაცემულია მესაკუთრეს',
  refunded: 'დაბრუნდა მოიჯარეს',
  disputed: 'დავა',
};
export const ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  pending: ['funded'],
  funded: ['released', 'refunded', 'disputed'],
  disputed: ['released', 'refunded'],
  released: [],
  refunded: [],
};
export function canEscrowTransition(from: EscrowStatus, to: EscrowStatus) {
  return ESCROW_TRANSITIONS[from].includes(to);
}

export const escrowCreateSchema = z.object({ offerId: z.string().uuid() });
export const escrowDisputeSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export type EscrowDto = {
  id: string;
  offerId: string;
  listing: { id: string; slug: string; title: string };
  tenant: { id: string; name: string | null };
  owner: { id: string; name: string | null };
  myRole: 'tenant' | 'owner' | 'admin';
  amountMinor: number;
  status: EscrowStatus;
  provider: string;
  contractUrl: string | null;
  tenantSignedAt: string | null;
  ownerSignedAt: string | null;
  disputeReason: string | null;
  history: { from: string; to: string; at: string; by?: string }[];
  createdAt: string;
};

export type LedgerReconciliation = { checkedTx: number; unbalanced: { txId: string; debitMinor: number; creditMinor: number }[]; balances: { account: string; balanceMinor: number }[]; ok: boolean };

/* ---------------- V4 rent & V9 property management ---------------- */

export const leaseCreateSchema = z.object({
  listingId: z.string().uuid(),
  tenantName: z.string().trim().min(2).max(160),
  tenantPhone: z.string().trim().max(20).nullish(),
  rentMinor: z.number().int().min(100).max(100_000_000),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  penaltyPctPerDay: z.number().min(0).max(5).default(0.1),
  autopay: z.boolean().default(false),
});
export const leaseUpdateSchema = z.object({
  rentMinor: z.number().int().min(100).max(100_000_000).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  penaltyPctPerDay: z.number().min(0).max(5).optional(),
  autopay: z.boolean().optional(),
  status: z.enum(['active', 'ended']).optional(),
});

export const RENT_STATUS_LABELS_KA = { open: 'გადასახდელი', paid: 'გადახდილი', overdue: 'ვადაგადაცილებული' } as const;
export const MAINTENANCE_STATUS_LABELS_KA = { open: 'ახალი', in_progress: 'მუშავდება', resolved: 'მოგვარებული' } as const;
export const MAINTENANCE_PRIORITY_LABELS_KA = { low: 'დაბალი', normal: 'ჩვეულებრივი', urgent: 'სასწრაფო' } as const;
export const UTILITY_KIND_LABELS_KA = { electricity: 'ელექტროენერგია', water: 'წყალი', gas: 'გაზი', cleaning: 'დასუფთავება', internet: 'ინტერნეტი' } as const;

export const maintenanceCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullish(),
  priority: z.enum(['low', 'normal', 'urgent']).default('normal'),
  /** Media ids from /v1/media/uploads (kind "photo") or already public URLs. */
  photos: z.array(z.string().max(500)).max(10).default([]),
});
export const maintenanceUpdateSchema = z.object({ status: z.enum(['open', 'in_progress', 'resolved']) });
export const utilityReadingSchema = z.object({
  kind: z.enum(['electricity', 'water', 'gas', 'cleaning', 'internet']),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reading: z.number().min(0).nullish(),
  amountMinor: z.number().int().min(0).max(100_000_000),
});
export const leaseMessageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export type RentInvoiceDto = { id: string; leaseId: string; period: string; amountMinor: number; penaltyMinor: number; totalMinor: number; dueOn: string; status: 'open' | 'paid' | 'overdue'; paidAt: string | null; lateNoticeSentAt: string | null };
export type MaintenanceDto = { id: string; leaseId: string; title: string; description: string | null; photos: string[]; priority: 'low' | 'normal' | 'urgent'; status: 'open' | 'in_progress' | 'resolved'; reporterName: string | null; createdAt: string; resolvedAt: string | null };
export type UtilityReadingDto = { id: string; kind: keyof typeof UTILITY_KIND_LABELS_KA; period: string; reading: number | null; amountMinor: number };
export type LeaseDto = {
  id: string;
  myRole: 'owner' | 'tenant';
  listing: { id: string; slug: string; title: string; address: string; cover: string | null };
  ownerName: string | null;
  tenantName: string;
  tenantPhone: string | null;
  tenantUserId: string | null;
  rentMinor: number;
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
  penaltyPctPerDay: number;
  autopay: boolean;
  status: 'active' | 'ended';
  balanceDueMinor: number;
  openMaintenance: number;
  nextDue: RentInvoiceDto | null;
};
export type LeaseDetailDto = LeaseDto & { invoices: RentInvoiceDto[]; maintenance: MaintenanceDto[]; utilities: UtilityReadingDto[]; messages: { id: string; fromMe: boolean; body: string; createdAt: string }[] };
export type PropertyOverview = { leases: LeaseDto[]; totals: { monthlyRentMinor: number; overdueMinor: number; openMaintenance: number; collectedThisMonthMinor: number } };

/* ---------------- V6 analytics API ---------------- */

export const API_SCOPES = ['districts:read', 'prices:read', 'vacancy:read', 'traffic:read', 'scores:read', 'reports:read'] as const;
export type ApiScope = (typeof API_SCOPES)[number];
export const API_SCOPE_LABELS_KA: Record<ApiScope, string> = {
  'districts:read': 'რაიონების სტატისტიკა',
  'prices:read': 'ფასების ინდექსი',
  'vacancy:read': 'ვაკანსიები',
  'traffic:read': 'ფეხით მოსიარულეთა ნაკადი',
  'scores:read': 'ლოკაციის ქულები',
  'reports:read': 'PDF ბაზრის რეპორტები',
};
export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).default([...API_SCOPES]),
  orgId: z.string().uuid().nullish(),
});
export type ApiKeyDto = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  planKey: string;
  rateLimitPerMin: number;
  monthlyQuota: number;
  usedThisMonth: number;
  orgId: string | null;
  orgName: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
export type ApiKeyCreated = ApiKeyDto & { key: string };
export type ApiUsageDto = { days: { day: string; count: number }[]; byEndpoint: { endpoint: string; count: number }[]; usedThisMonth: number; monthlyQuota: number };

/* ---------------- V8 currency ---------------- */

export const DISPLAY_CURRENCIES = ['GEL', 'USD', 'EUR'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
/** GEL per 1 unit of currency. */
export type FxRatesResponse = { base: 'GEL'; day: string | null; rates: Record<'USD' | 'EUR', number>; provider: string };
/** Converts tetri to a display currency amount (major units, rounded). */
export function convertMinor(minor: number, currency: DisplayCurrency, rates: FxRatesResponse['rates'] | null | undefined): number {
  const gel = minor / 100;
  if (currency === 'GEL' || !rates) return Math.round(gel);
  const rate = rates[currency];
  return rate ? Math.round(gel / rate) : Math.round(gel);
}
export function formatCurrencyAmount(amount: number, currency: DisplayCurrency): string {
  const n = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return currency === 'GEL' ? `${n} ₾` : currency === 'USD' ? `$${n}` : `€${n}`;
}

/* ---------------- V10 finance marketplace ---------------- */

export const FINANCE_KIND_LABELS_KA = { fitout_loan: 'მოწყობის სესხი', leasing: 'ლიზინგი', insurance: 'დაზღვევა' } as const;
export const FINANCE_STATUS_LABELS_KA = { submitted: 'გაგზავნის მოლოდინში', sent: 'პარტნიორთან განხილვაში', approved: 'დამტკიცებული', rejected: 'უარყოფილი' } as const;
export type FinanceProductDto = {
  id: string;
  partner: string;
  kind: keyof typeof FINANCE_KIND_LABELS_KA;
  name: string;
  description: string;
  rateText: string | null;
  minAmountMinor: number | null;
  maxAmountMinor: number | null;
  commissionPct: number;
  active: boolean;
};
export const financeApplicationSchema = z.object({
  productId: z.string().uuid(),
  listingId: z.string().uuid().nullish(),
  amountMinor: z.number().int().min(0).max(10_000_000_000),
  termMonths: z.number().int().min(1).max(360).nullish(),
  companyName: z.string().trim().max(160).nullish(),
  phone: z.string().trim().max(20).nullish(),
  message: z.string().trim().max(2000).nullish(),
  consent: z.literal(true, { message: 'საჭიროია თანხმობა მონაცემების პარტნიორისთვის გადაცემაზე' }),
});
export type FinanceApplicationDto = {
  id: string;
  product: { id: string; name: string; partner: string; kind: keyof typeof FINANCE_KIND_LABELS_KA };
  listing: { id: string; slug: string; title: string } | null;
  amountMinor: number;
  termMonths: number | null;
  status: keyof typeof FINANCE_STATUS_LABELS_KA;
  partnerRef: string | null;
  commissionMinor: number | null;
  consentAt: string;
  createdAt: string;
  applicant?: { id: string; name: string | null; phone: string | null };
};
