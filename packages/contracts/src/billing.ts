/** Zod schemas & types owned by the billing work stream (Phase 13). `checkoutSchema` lives in domain.ts. */
import { z } from 'zod';

export const PLAN_AUDIENCES = ['user', 'agent', 'org', 'developer', 'listing', 'report', 'api'] as const;
export type PlanAudience = (typeof PLAN_AUDIENCES)[number];

export type PlanDto = {
  id: string;
  key: string;
  nameKa: string;
  audience: PlanAudience;
  kind: 'subscription' | 'one_time';
  priceMinor: number;
  days: number | null;
  features: string[];
  limits: Record<string, number>;
  active: boolean;
  sort: number;
};

export type PlansResponse = { promoActive: boolean; promoUntil: string | null; plans: PlanDto[] };

export const INVOICE_PURPOSES = ['subscription', 'vip', 'report', 'transfer_listing', 'service_commission', 'rent', 'api', 'escrow'] as const;
export type InvoicePurpose = (typeof INVOICE_PURPOSES)[number];
export const INVOICE_PURPOSE_LABELS_KA: Record<InvoicePurpose, string> = {
  subscription: 'გამოწერა',
  vip: 'VIP განცხადება',
  report: 'ლოკაციის რეპორტი',
  transfer_listing: 'ბიზნესის გადაცემის განცხადება',
  service_commission: 'მომსახურების კომისია',
  rent: 'იჯარის გადახდა',
  api: 'ანალიტიკის API',
  escrow: 'დეპოზიტი (ესქროუ)',
};
export const INVOICE_STATUS_LABELS_KA = { open: 'გადასახდელი', paid: 'გადახდილი', void: 'გაუქმებული', failed: 'ვერ შესრულდა' } as const;
export const SUBSCRIPTION_STATUS_LABELS_KA = {
  pending: 'მოლოდინში',
  active: 'აქტიური',
  past_due: 'ვადაგადაცილებული',
  grace: 'საშეღავათო პერიოდი',
  cancelled: 'გაუქმებული',
  expired: 'ვადაგასული',
} as const;
export type SubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS_LABELS_KA;

/** Checkout body accepted by POST /v1/billing/checkout (extends domain checkoutSchema). */
export const checkoutRequestSchema = z.object({
  planKey: z.string().min(1).max(40),
  orgId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  businessType: z.string().max(40).optional(),
  seats: z.number().int().min(1).max(500).default(1),
  provider: z.enum(['mock', 'bog', 'tbc', 'psp']).optional(),
  /** Client-generated key: repeated submits return the same invoice/payment. */
  idempotencyKey: z.string().min(8).max(100).optional(),
  /** Where to send the user after payment (path on the portal). */
  returnPath: z.string().max(300).regex(/^\/(?!\/)/).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export type CheckoutResponse = {
  invoiceId: string;
  paymentId: string | null;
  /** `redirect` → go to checkoutUrl; `paid` → completed instantly (launch promo / 0 ₾). */
  status: 'redirect' | 'paid';
  checkoutUrl: string | null;
  redirectUrl: string;
  amountMinor: number;
  promo: boolean;
};

export type PaymentSummary = {
  id: string;
  status: 'created' | 'pending' | 'succeeded' | 'failed' | 'refunded';
  amountMinor: number;
  currency: string;
  provider: string;
  invoice: { id: string; number: string; purpose: InvoicePurpose; lines: { name: string; qty: number; amountMinor: number }[]; status: string };
  description: string;
  returnPath: string;
};

export const mockPaymentCompleteSchema = z.object({ outcome: z.enum(['succeeded', 'failed']) });

export type InvoiceDto = {
  id: string;
  number: string;
  purpose: InvoicePurpose;
  lines: { name: string; qty: number; amountMinor: number }[];
  amountMinor: number;
  currency: string;
  status: 'open' | 'paid' | 'void' | 'failed';
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  orgId: string | null;
  lastPaymentId: string | null;
};

export type SubscriptionDto = {
  id: string;
  planKey: string;
  planName: string;
  priceMinor: number;
  orgId: string | null;
  orgName: string | null;
  status: SubscriptionStatus;
  seats: number;
  periodStart: string | null;
  periodEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  failedAttempts: number;
};

export type ReportPurchaseDto = {
  id: string;
  productKey: string;
  productName: string;
  districtId: string | null;
  districtName: string | null;
  businessType: string | null;
  status: 'pending' | 'paid' | 'ready';
  createdAt: string;
  downloadUrl: string | null;
};

export const reportPreviewQuerySchema = z.object({ districtId: z.string().uuid(), businessType: z.string().max(40).optional() });
export type ReportPreview = {
  district: { id: string; name: string; city: string };
  businessType: string | null;
  activeCount: number;
  avgPriceM2Minor: number | null;
  competitorsCount: number;
  sampleSize: number;
};

export type BillingOverview = {
  subscriptions: SubscriptionDto[];
  invoices: InvoiceDto[];
  reports: ReportPurchaseDto[];
  promoActive: boolean;
  promoUntil: string | null;
};
