import { boolean, date, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns, ts } from './_common';

export const plans = pgTable('plans', {
  ...baseColumns,
  key: text('key').notNull().unique(),
  nameKa: text('name_ka').notNull(),
  audience: text('audience', { enum: ['user', 'agent', 'org', 'developer', 'listing', 'report', 'api'] }).notNull(),
  kind: text('kind', { enum: ['subscription', 'one_time'] }).notNull(),
  priceMinor: integer('price_minor').notNull(),
  days: integer('days'),
  features: jsonb('features').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  limits: jsonb('limits').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    ...baseColumns,
    orgId: uuid('org_id'),
    userId: uuid('user_id'),
    planKey: text('plan_key').notNull(),
    status: text('status', { enum: ['pending', 'active', 'past_due', 'grace', 'cancelled', 'expired'] })
      .notNull()
      .default('pending'),
    seats: integer('seats').notNull().default(1),
    periodStart: ts('period_start'),
    periodEnd: ts('period_end'),
    graceUntil: ts('grace_until'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    downgradedAt: ts('downgraded_at'),
  },
  (t) => [index('subs_org_idx').on(t.orgId), index('subs_user_idx').on(t.userId)],
);

export const invoices = pgTable(
  'invoices',
  {
    ...baseColumns,
    number: text('number').notNull(),
    orgId: uuid('org_id'),
    userId: uuid('user_id'),
    subscriptionId: uuid('subscription_id'),
    purpose: text('purpose', { enum: ['subscription', 'vip', 'report', 'transfer_listing', 'service_commission', 'rent', 'api'] })
      .notNull(),
    refId: uuid('ref_id'),
    lines: jsonb('lines').$type<{ name: string; qty: number; amountMinor: number }[]>().notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('GEL'),
    status: text('status', { enum: ['open', 'paid', 'void', 'failed'] }).notNull().default('open'),
    dueAt: ts('due_at'),
    paidAt: ts('paid_at'),
    pdfUrl: text('pdf_url'),
  },
  (t) => [uniqueIndex('invoices_number_uq').on(t.number)],
);

export const payments = pgTable('payments', {
  ...baseColumns,
  invoiceId: uuid('invoice_id').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  status: text('status', { enum: ['created', 'pending', 'succeeded', 'failed', 'refunded'] }).notNull().default('created'),
  attempts: integer('attempts').notNull().default(0),
  checkoutUrl: text('checkout_url'),
  raw: jsonb('raw'),
});

export const webhookEvents = pgTable(
  'webhook_events',
  {
    ...baseColumns,
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: ts('processed_at'),
  },
  (t) => [uniqueIndex('webhook_provider_event_uq').on(t.provider, t.eventId)],
);

/* ---------- v2 ---------- */

export const escrowAccounts = pgTable('escrow_accounts', {
  ...baseColumns,
  offerId: uuid('offer_id').notNull(),
  listingId: uuid('listing_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  status: text('status', { enum: ['pending', 'funded', 'released', 'refunded', 'disputed'] }).notNull().default('pending'),
  provider: text('provider').notNull().default('mock'),
  providerRef: text('provider_ref'),
  disputeReason: text('dispute_reason'),
  history: jsonb('history').$type<{ from: string; to: string; at: string; by?: string }[]>().notNull().default(sql`'[]'::jsonb`),
});

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    ...baseColumns,
    txId: uuid('tx_id').notNull(),
    account: text('account').notNull(),
    debitMinor: integer('debit_minor').notNull().default(0),
    creditMinor: integer('credit_minor').notNull().default(0),
    currency: text('currency').notNull().default('GEL'),
    refType: text('ref_type').notNull(),
    refId: uuid('ref_id'),
    memo: text('memo'),
  },
  (t) => [index('ledger_tx_idx').on(t.txId), index('ledger_account_idx').on(t.account)],
);

export const leases = pgTable('leases', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  tenantId: uuid('tenant_id'),
  tenantName: text('tenant_name').notNull(),
  tenantPhone: text('tenant_phone'),
  offerId: uuid('offer_id'),
  rentMinor: integer('rent_minor').notNull(),
  dayOfMonth: integer('day_of_month').notNull().default(1),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }),
  penaltyPctPerDay: numeric('penalty_pct_per_day', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0.1),
  autopay: boolean('autopay').notNull().default(false),
  status: text('status', { enum: ['active', 'ended'] }).notNull().default('active'),
});

export const rentInvoices = pgTable(
  'rent_invoices',
  {
    ...baseColumns,
    leaseId: uuid('lease_id').notNull(),
    period: text('period').notNull(), // YYYY-MM
    amountMinor: integer('amount_minor').notNull(),
    penaltyMinor: integer('penalty_minor').notNull().default(0),
    dueOn: date('due_on', { mode: 'string' }).notNull(),
    status: text('status', { enum: ['open', 'paid', 'overdue'] }).notNull().default('open'),
    paidAt: ts('paid_at'),
    invoiceId: uuid('invoice_id'),
    lateNoticeSentAt: ts('late_notice_sent_at'),
  },
  (t) => [uniqueIndex('rent_invoices_lease_period_uq').on(t.leaseId, t.period)],
);

export const maintenanceRequests = pgTable('maintenance_requests', {
  ...baseColumns,
  leaseId: uuid('lease_id').notNull(),
  reporterId: uuid('reporter_id'),
  title: text('title').notNull(),
  description: text('description'),
  photos: jsonb('photos').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  priority: text('priority', { enum: ['low', 'normal', 'urgent'] }).notNull().default('normal'),
  status: text('status', { enum: ['open', 'in_progress', 'resolved'] }).notNull().default('open'),
  resolvedAt: ts('resolved_at'),
});

export const utilityReadings = pgTable('utility_readings', {
  ...baseColumns,
  leaseId: uuid('lease_id').notNull(),
  kind: text('kind', { enum: ['electricity', 'water', 'gas', 'cleaning', 'internet'] }).notNull(),
  period: text('period').notNull(),
  reading: numeric('reading', { precision: 12, scale: 2, mode: 'number' }),
  amountMinor: integer('amount_minor').notNull(),
});

export const scans = pgTable('scans', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  uploadedBy: uuid('uploaded_by'),
  format: text('format', { enum: ['glb', 'gltf', 'obj', 'usdz', 'ply'] }).notNull(),
  url: text('url').notNull(),
  status: text('status', { enum: ['processing', 'ready', 'failed'] }).notNull().default('processing'),
  plan: jsonb('plan').$type<{ outline: [number, number][]; widthM: number; depthM: number; areaM2: number }>(),
});

export const apiKeys = pgTable('api_keys', {
  ...baseColumns,
  orgId: uuid('org_id'),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
  planKey: text('plan_key').notNull().default('api_basic'),
  rateLimitPerMin: integer('rate_limit_per_min').notNull().default(60),
  monthlyQuota: integer('monthly_quota').notNull().default(10000),
  lastUsedAt: ts('last_used_at'),
  revokedAt: ts('revoked_at'),
});

export const apiUsage = pgTable(
  'api_usage',
  {
    ...baseColumns,
    apiKeyId: uuid('api_key_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    endpoint: text('endpoint').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [uniqueIndex('api_usage_key_day_ep_uq').on(t.apiKeyId, t.day, t.endpoint)],
);

export const financeProducts = pgTable('finance_products', {
  ...baseColumns,
  partner: text('partner').notNull(),
  kind: text('kind', { enum: ['fitout_loan', 'leasing', 'insurance'] }).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  rateText: text('rate_text'),
  minAmountMinor: integer('min_amount_minor'),
  maxAmountMinor: integer('max_amount_minor'),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(1),
  active: boolean('active').notNull().default(true),
});

export const financeApplications = pgTable('finance_applications', {
  ...baseColumns,
  productId: uuid('product_id').notNull(),
  userId: uuid('user_id').notNull(),
  listingId: uuid('listing_id'),
  amountMinor: integer('amount_minor').notNull(),
  termMonths: integer('term_months'),
  consentAt: ts('consent_at').notNull(),
  status: text('status', { enum: ['submitted', 'sent', 'approved', 'rejected'] }).notNull().default('submitted'),
  partnerRef: text('partner_ref'),
  commissionMinor: integer('commission_minor'),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
});

export const fxRates = pgTable(
  'fx_rates',
  {
    ...baseColumns,
    currency: text('currency').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    /** GEL per 1 unit of currency ×10000 */
    rateX10000: integer('rate_x10000').notNull(),
  },
  (t) => [uniqueIndex('fx_currency_day_uq').on(t.currency, t.day)],
);
