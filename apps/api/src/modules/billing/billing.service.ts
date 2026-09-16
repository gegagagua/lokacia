import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import {
  and, apiKeys, desc, eq, gt, gte, inArray, ne, invoices, isNull, listings, lt, memberships, or, organizations, payments, plans, reportPurchases, sql, subscriptions, webhookEvents,
} from '@lokacia/db';
import {
  INVOICE_PURPOSE_LABELS_KA, formatDateKa, formatMoney, type CheckoutRequest, type CheckoutResponse, type InvoiceDto, type InvoicePurpose, type PaymentSummary, type PlanDto,
  type SubscriptionDto,
} from '@lokacia/contracts';
import { ENV, type Env } from '../../config/env';
import { DbService } from '../../common/db.service';
import { problems, ProblemException } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import { RateLimitService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import type { AuthUser } from '../../common/request';
import { PAYMENTS, type PaymentProvider } from '../../integrations/payments/payments';
import { MockPayments } from '../../integrations/payments/payments.mock';
import { ListingReadService } from '../listings/listing-read.service';
import { NotificationsService } from '../notifications/notifications.service';
import { registerTemplates } from '../notifications/templates';
import { SearchService } from '../search/search.service';
import { ReportsService } from './reports.service';

type InvoiceRow = typeof invoices.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PlanRow = typeof plans.$inferSelect;
type SubRow = typeof subscriptions.$inferSelect;

/** Effect applied when an invoice of a purpose becomes paid (registered by other modules, e.g. rent/escrow). */
export type PurposeHandler = (invoice: InvoiceRow) => Promise<void>;

export type PaymentInput = {
  userId: string;
  orgId?: string | null;
  purpose: InvoicePurpose;
  refId?: string | null;
  subscriptionId?: string | null;
  lines: { name: string; qty: number; amountMinor: number }[];
  description: string;
  returnPath: string;
  idempotencyKey?: string;
  /** Launch promo applies (false for rent/escrow — money between third parties). */
  allowPromo: boolean;
  provider?: string;
  /** Extra data kept on the payment (e.g. planKey) for effects. */
  meta?: Record<string, unknown>;
};

registerTemplates({
  subscription_expired: { title: () => 'გამოწერა გაუქმდა', body: (v) => `${v.plan}: გადახდა არ შესრულდა, პაკეტი შეიცვალა უფასოთი.` },
  subscription_renewal: { title: () => 'გამოწერის განახლება', body: (v) => `${v.plan}: ${v.amount}. გადაიხადეთ ${v.until}-მდე.` },
  report_ready: { title: () => 'რეპორტი მზად არის', body: (v) => `${v.name} — ჩამოტვირთეთ PDF.` },
  vip_activated: { title: () => 'VIP ჩართულია', body: (v) => `„${v.title}“ — VIP ${v.until}-მდე.` },
});

export const PROMO_LINE_KA = 'უფასო პრომო-პერიოდში';
/** invoices/payments.amount_minor are int4 columns (≈ 21.4M ₾). */
export const MAX_INVOICE_MINOR = 2_000_000_000;

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger('Billing');
  private readonly handlers = new Map<InvoicePurpose, PurposeHandler>();

  constructor(
    private readonly dbs: DbService,
    private readonly settings: SettingsService,
    private readonly queue: QueueService,
    private readonly notify: NotificationsService,
    private readonly search: SearchService,
    private readonly read: ListingReadService,
    private readonly reports: ReportsService,
    @Inject(PAYMENTS) readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly rate: RateLimitService,
  ) {}

  onModuleInit() {
    this.queue.register('billing.lifecycle', () => this.runLifecycle());
    this.queue.register('billing.retry-failed', () => this.retryFailed());
    this.queue.register('billing.report', (d: { purchaseId: string }) => this.reports.generatePurchase(d.purchaseId));
    this.queue.every('billing.lifecycle', 3600_000);
    this.queue.every('billing.retry-failed', 6 * 3600_000);
  }

  registerHandler(purpose: InvoicePurpose, handler: PurposeHandler) {
    this.handlers.set(purpose, handler);
  }

  /* ---------------- plans ---------------- */

  planDto(p: PlanRow): PlanDto {
    return { id: p.id, key: p.key, nameKa: p.nameKa, audience: p.audience, kind: p.kind, priceMinor: p.priceMinor, days: p.days, features: p.features, limits: p.limits, active: p.active, sort: p.sort };
  }

  async plans(includeInactive = false) {
    const rows = await this.dbs.db.select().from(plans).where(includeInactive ? isNull(plans.deletedAt) : and(isNull(plans.deletedAt), eq(plans.active, true))).orderBy(plans.sort);
    return rows.map((p) => this.planDto(p));
  }

  async plansResponse() {
    return { promoActive: await this.settings.promoActive(), promoUntil: (await this.settings.get<string | null>('launch_promo_until')) ?? null, plans: await this.plans() };
  }

  private async plan(key: string) {
    const p = await this.dbs.db.query.plans.findFirst({ where: and(eq(plans.key, key), isNull(plans.deletedAt)) });
    if (!p || !p.active) throw problems.notFound('პაკეტი');
    return p;
  }

  async graceHours() {
    const v = Number(await this.settings.get('billing_grace_hours'));
    return Number.isFinite(v) && v >= 0 ? v : 72;
  }

  /* ---------------- permissions ---------------- */

  async managedOrgIds(userId: string) {
    const rows = await this.dbs.db
      .select({ orgId: memberships.orgId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.role, 'manager'), eq(memberships.active, true), isNull(memberships.deletedAt)));
    return rows.map((r) => r.orgId);
  }

  private async assertOrgManager(user: AuthUser, orgId: string) {
    if (user.role === 'admin') return;
    if (!(await this.managedOrgIds(user.id)).includes(orgId)) throw problems.forbidden('ორგანიზაციის გამოწერას მართავს მხოლოდ მენეჯერი');
  }

  private async assertOrgMember(user: AuthUser, orgId: string) {
    if (user.role === 'admin') return;
    const m = await this.dbs.db.query.memberships.findFirst({
      where: and(eq(memberships.orgId, orgId), eq(memberships.userId, user.id), eq(memberships.active, true), isNull(memberships.deletedAt)),
    });
    if (!m) throw problems.forbidden('თქვენ არ ხართ ამ ორგანიზაციის წევრი');
  }

  private async canSeeInvoice(user: AuthUser, inv: InvoiceRow) {
    if (user.role === 'admin') return true;
    if (inv.userId === user.id) return true;
    return !!inv.orgId && (await this.managedOrgIds(user.id)).includes(inv.orgId);
  }

  /* ---------------- checkout ---------------- */

  async checkout(user: AuthUser, input: CheckoutRequest): Promise<CheckoutResponse> {
    const idem = input.idempotencyKey ? `${user.id}:${input.idempotencyKey}` : undefined;
    if (idem) {
      const existing = await this.dbs.db.query.payments.findFirst({ where: eq(payments.idempotencyKey, idem) });
      if (existing) return this.responseFor(existing);
    }
    // invoice/checkout spam (and launch-promo abuse: every promo checkout settles instantly)
    await this.rate.hit(`checkout:user:${user.id}`, 30, 3600);
    const plan = await this.plan(input.planKey);
    const returnPath = input.returnPath ?? '/account/billing';
    const base = { userId: user.id, returnPath, idempotencyKey: idem, allowPromo: true, provider: input.provider };

    switch (plan.audience) {
      case 'listing': {
        if (!input.listingId) throw problems.badRequest('listingId სავალდებულოია');
        const l = await this.read.findRaw(input.listingId);
        if (!l) throw problems.notFound('განცხადება');
        if (!(await this.read.canManage(l, user))) throw problems.forbidden();
        const purpose: InvoicePurpose = plan.key === 'transfer_listing' ? 'transfer_listing' : 'vip';
        return this.createPayment({ ...base, meta: { planKey: plan.key }, orgId: l.orgId, purpose, refId: l.id, lines: [{ name: `${plan.nameKa} — ${l.title}`, qty: 1, amountMinor: plan.priceMinor }], description: `${plan.nameKa}: ${l.title}` });
      }
      case 'report': {
        if (!input.districtId) throw problems.badRequest('districtId სავალდებულოია');
        const district = await this.dbs.db.query.districts.findFirst({ where: (d, { eq: e }) => e(d.id, input.districtId!) });
        if (!district) throw problems.notFound('რაიონი');
        if (input.orgId) await this.assertOrgMember(user, input.orgId);
        const [purchase] = await this.dbs.db
          .insert(reportPurchases)
          .values({ userId: user.id, orgId: input.orgId ?? null, districtId: district.id, businessType: input.businessType ?? null, productKey: plan.key, status: 'pending' })
          .returning();
        const name = `${plan.nameKa} — ${district.nameKa}${input.businessType ? ` · ${input.businessType}` : ''}`;
        const res = await this.createPayment({ ...base, orgId: input.orgId ?? null, purpose: 'report', refId: purchase!.id, lines: [{ name, qty: 1, amountMinor: plan.priceMinor }], description: name });
        await this.dbs.db.update(reportPurchases).set({ invoiceId: res.invoiceId }).where(eq(reportPurchases.id, purchase!.id));
        return res;
      }
      default: {
        // subscriptions: user / agent / org / developer / api
        const orgScoped = plan.audience === 'org' || plan.audience === 'developer' || (plan.audience === 'api' && !!input.orgId) || (plan.audience === 'agent' && !!input.orgId);
        if ((plan.audience === 'org' || plan.audience === 'developer') && !input.orgId) throw problems.badRequest('orgId სავალდებულოია ორგანიზაციის პაკეტისთვის');
        if (orgScoped) await this.assertOrgManager(user, input.orgId!);
        const seats = plan.audience === 'agent' ? input.seats : plan.audience === 'org' ? Math.max(input.seats, 1) : 1;
        const includedSeats = plan.limits.seats ?? 1;
        const amount = plan.audience === 'agent' ? plan.priceMinor * seats : plan.audience === 'org' && seats > includedSeats ? plan.priceMinor + Math.round((plan.priceMinor / includedSeats) * (seats - includedSeats)) : plan.priceMinor;
        const owner = orgScoped ? { orgId: input.orgId!, userId: null } : { orgId: null, userId: user.id };
        let sub = await this.dbs.db.query.subscriptions.findFirst({
          where: and(
            owner.orgId ? eq(subscriptions.orgId, owner.orgId) : eq(subscriptions.userId, user.id),
            eq(subscriptions.planKey, plan.key),
            inArray(subscriptions.status, ['pending', 'active', 'past_due', 'grace']),
            isNull(subscriptions.deletedAt),
          ),
        });
        if (!sub) [sub] = await this.dbs.db.insert(subscriptions).values({ ...owner, planKey: plan.key, seats, status: 'pending' }).returning();
        else if (sub.seats !== seats) await this.dbs.db.update(subscriptions).set({ seats }).where(eq(subscriptions.id, sub.id));
        return this.createPayment({
          ...base,
          orgId: owner.orgId,
          purpose: plan.audience === 'api' ? 'api' : 'subscription',
          subscriptionId: sub!.id,
          refId: sub!.id,
          lines: [{ name: `${plan.nameKa}${seats > 1 ? ` · ${seats} ადგილი` : ''} — ${plan.days ?? 30} დღე`, qty: 1, amountMinor: amount }],
          description: plan.nameKa,
        });
      }
    }
  }

  private invoiceNumber() {
    const d = new Date();
    return `LK-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private redirectPath(invoiceId: string, returnPath: string, status?: 'failed') {
    const q = new URLSearchParams({ invoice: invoiceId, return: returnPath });
    if (status) q.set('status', status);
    return `/checkout/result?${q}`;
  }

  private async responseFor(p: PaymentRow): Promise<CheckoutResponse> {
    const raw = (p.raw ?? {}) as { returnPath?: string; promo?: boolean };
    const inv = await this.dbs.db.query.invoices.findFirst({ where: eq(invoices.id, p.invoiceId) });
    const paid = p.status === 'succeeded';
    return {
      invoiceId: p.invoiceId,
      paymentId: p.id,
      status: paid ? 'paid' : 'redirect',
      checkoutUrl: paid ? null : p.checkoutUrl,
      redirectUrl: this.redirectPath(p.invoiceId, raw.returnPath ?? '/account/billing'),
      amountMinor: inv?.amountMinor ?? p.amountMinor,
      promo: !!raw.promo,
    };
  }

  /** Checkout response for an invoice that still has an unpaid in-flight payment (re-used instead of issuing a second invoice). */
  async openCheckout(invoiceId: string): Promise<CheckoutResponse | null> {
    const inv = await this.dbs.db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
    if (!inv || inv.status !== 'open') return null;
    const p = await this.dbs.db.query.payments.findFirst({ where: and(eq(payments.invoiceId, invoiceId), inArray(payments.status, ['created', 'pending'])), orderBy: desc(payments.createdAt) });
    return p ? this.responseFor(p) : null;
  }

  /** Invoice + payment (idempotent) → provider hosted checkout; instant settlement for promo / zero amount. */
  async createPayment(input: PaymentInput): Promise<CheckoutResponse> {
    if (input.idempotencyKey) {
      const existing = await this.dbs.db.query.payments.findFirst({ where: eq(payments.idempotencyKey, input.idempotencyKey) });
      if (existing) return this.responseFor(existing);
    }
    for (const l of input.lines) {
      if (!Number.isSafeInteger(l.amountMinor) || l.amountMinor < 0 || !Number.isSafeInteger(l.qty) || l.qty < 1) throw problems.badRequest('არასწორი თანხა');
    }
    const promo = input.allowPromo && (await this.settings.promoActive());
    const total = input.lines.reduce((a, l) => a + l.amountMinor * l.qty, 0);
    // invoices.amount_minor is int4: refuse instead of failing with a DB overflow
    if (total > MAX_INVOICE_MINOR) throw new ProblemException(422, 'amount-too-large', 'თანხა ძალიან დიდია', `max ${MAX_INVOICE_MINOR} tetri`);
    const free = promo || total === 0;
    const lines = free && total > 0 ? [...input.lines.map((l) => ({ ...l, name: `${l.name} (${PROMO_LINE_KA})`, amountMinor: 0 }))] : input.lines;
    const amountMinor = free ? 0 : total;
    const invoiceId = uuidv7();
    const paymentId = uuidv7();
    const now = new Date();
    const provider = free ? 'promo' : this.provider.name;
    try {
      await this.dbs.db.transaction(async (tx) => {
        await tx.insert(invoices).values({
          id: invoiceId, number: this.invoiceNumber(), orgId: input.orgId ?? null, userId: input.userId, subscriptionId: input.subscriptionId ?? null, purpose: input.purpose, refId: input.refId ?? null,
          lines, amountMinor, status: 'open', dueAt: new Date(now.getTime() + 3 * 86_400_000),
        });
        await tx.insert(payments).values({
          id: paymentId, invoiceId, amountMinor, provider, idempotencyKey: input.idempotencyKey ?? `pay:${paymentId}`, status: 'created',
          raw: { ...input.meta, returnPath: input.returnPath, description: input.description, promo, originalAmountMinor: total },
        });
      });
    } catch (e) {
      // a concurrent request with the same idempotency key won the unique index → return its payment instead of a 500
      const err = e as { code?: string; cause?: { code?: string } };
      if ((err.code ?? err.cause?.code) === '23505' && input.idempotencyKey) {
        const existing = await this.dbs.db.query.payments.findFirst({ where: eq(payments.idempotencyKey, input.idempotencyKey) });
        if (existing) return this.responseFor(existing);
      }
      throw e;
    }
    if (free) {
      await this.markPaid(paymentId, { providerRef: `promo_${paymentId}` });
    } else {
      const inv = await this.dbs.db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
      try {
        const r = await this.provider.createCheckout({ paymentId, invoiceNumber: inv!.number, amountMinor, currency: 'GEL', description: input.description, returnUrl: `${this.env.APP_URL}${this.redirectPath(invoiceId, input.returnPath)}` });
        await this.dbs.db.update(payments).set({ providerRef: r.providerRef, checkoutUrl: r.checkoutUrl, status: 'pending', attempts: 1 }).where(eq(payments.id, paymentId));
      } catch (e) {
        this.logger.warn(`createCheckout failed: ${(e as Error).message}`);
        await this.dbs.db.update(payments).set({ status: 'failed', attempts: 1 }).where(eq(payments.id, paymentId));
        await this.dbs.db.update(invoices).set({ status: 'failed' }).where(eq(invoices.id, invoiceId));
        throw new ProblemException(502, 'payment-provider', 'გადახდის სისტემა დროებით მიუწვდომელია', 'სცადეთ ცოტა ხანში');
      }
    }
    const p = await this.dbs.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    return this.responseFor(p!);
  }

  /**
   * Off-session charge (autopay with a saved card at the PSP). Settles immediately in dev/mock; real adapters
   * would call the provider's recurring-payment API.
   */
  async chargeOffSession(input: Omit<PaymentInput, 'allowPromo' | 'returnPath'>) {
    const invoiceId = uuidv7();
    const paymentId = uuidv7();
    const amountMinor = input.lines.reduce((a, l) => a + l.amountMinor * l.qty, 0);
    await this.dbs.db.insert(invoices).values({ id: invoiceId, number: this.invoiceNumber(), orgId: input.orgId ?? null, userId: input.userId, purpose: input.purpose, refId: input.refId ?? null, lines: input.lines, amountMinor, status: 'open', dueAt: new Date() });
    await this.dbs.db.insert(payments).values({ id: paymentId, invoiceId, amountMinor, provider: this.provider.name, idempotencyKey: input.idempotencyKey ?? `autopay:${paymentId}`, status: 'pending', attempts: 1, raw: { description: input.description, autopay: true } });
    await this.markPaid(paymentId, { providerRef: `autopay_${paymentId}` });
    return invoiceId;
  }

  /* ---------------- webhooks ---------------- */

  async handleWebhook(providerName: string, headers: Record<string, string | string[] | undefined>, rawBody: string) {
    if (providerName !== this.provider.name) throw new ProblemException(404, 'unknown-provider', 'გადახდის პროვაიდერი ვერ მოიძებნა');
    let event;
    try {
      event = this.provider.parseWebhook(headers, rawBody);
    } catch (e) {
      this.logger.warn(`webhook ${providerName} rejected: ${(e as Error).message}`);
      throw new ProblemException(401, 'invalid-signature', 'ხელმოწერა არასწორია');
    }
    const inserted = await this.dbs.db
      .insert(webhookEvents)
      .values({ provider: providerName, eventId: event.eventId, payload: event.raw as object })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    let eventRowId = inserted[0]?.id;
    if (!eventRowId) {
      // Replay of a processed event is a no-op. An event recorded but never processed (crash mid-way) is processed again:
      // every state change below is a conditional update, so duplicate/concurrent processing stays idempotent.
      const prev = await this.dbs.db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.provider, providerName), eq(webhookEvents.eventId, event.eventId)) });
      if (!prev || prev.processedAt) return { ok: true, duplicate: true };
      eventRowId = prev.id;
    }
    const payment = await this.dbs.db.query.payments.findFirst({ where: and(eq(payments.providerRef, event.providerRef), eq(payments.provider, providerName)) });
    let outcome = payment ? 'ignored' : 'unknown-payment';
    if (payment) {
      const inv = await this.dbs.db.query.invoices.findFirst({ where: eq(invoices.id, payment.invoiceId) });
      if (event.status === 'succeeded') {
        // settle only when the PSP confirms exactly the invoiced amount and currency
        const amountOk = event.amountMinor !== undefined && event.amountMinor === payment.amountMinor;
        const currencyOk = !event.currency || event.currency === (inv?.currency ?? 'GEL');
        if (!amountOk || !currencyOk) {
          this.logger.warn(`amount/currency mismatch for payment ${payment.id}: ${event.amountMinor} ${event.currency ?? ''} != ${payment.amountMinor} ${inv?.currency ?? ''}`);
          await this.markFailed(payment.id, 'amount mismatch');
          outcome = 'mismatch';
        } else {
          await this.markPaid(payment.id, {});
          outcome = 'succeeded';
        }
      } else if (event.status === 'failed') {
        await this.markFailed(payment.id, 'provider declined');
        outcome = 'failed';
      } else if (event.status === 'refunded') {
        // forward-only: only a settled payment can become refunded
        const [r] = await this.dbs.db.update(payments).set({ status: 'refunded' }).where(and(eq(payments.id, payment.id), eq(payments.status, 'succeeded'))).returning({ id: payments.id });
        outcome = r ? 'refunded' : 'ignored';
      }
    } else {
      this.logger.warn(`webhook ${providerName} event ${event.eventId} for unknown payment ref ${event.providerRef}`);
    }
    await this.dbs.db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, eventRowId));
    return { ok: true, duplicate: false, matched: !!payment, outcome };
  }

  /** Dev helper for the hosted mock checkout page: sign a webhook the same way the PSP would and process it. */
  async mockComplete(user: AuthUser, paymentId: string, outcome: 'succeeded' | 'failed') {
    if (this.env.NODE_ENV === 'production' || !(this.provider instanceof MockPayments)) throw problems.forbidden('სატესტო გადახდა ხელმისაწვდომია მხოლოდ დემო-რეჟიმში');
    const summary = await this.paymentSummary(user, paymentId);
    const p = await this.dbs.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (p!.status === 'created' || !p!.providerRef) throw problems.conflict('გადახდა არ არის ინიცირებული');
    if (p!.status === 'pending' || p!.status === 'failed') {
      const body = JSON.stringify({ id: `evt_${uuidv7()}`, ref: p!.providerRef, status: outcome, amount: p!.amountMinor });
      await this.handleWebhook('mock', { 'x-signature': this.provider.sign(body) }, body);
    }
    const after = await this.dbs.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    return { status: after!.status, redirectUrl: this.redirectPath(p!.invoiceId, summary.returnPath, after!.status === 'succeeded' ? undefined : 'failed') };
  }

  async markPaid(paymentId: string, patch: { providerRef?: string }) {
    // forward-only: created/pending/failed → succeeded (a refunded or already-succeeded payment never settles again)
    const [p] = await this.dbs.db
      .update(payments)
      .set({ status: 'succeeded', ...(patch.providerRef ? { providerRef: patch.providerRef } : {}) })
      .where(and(eq(payments.id, paymentId), inArray(payments.status, ['created', 'pending', 'failed'])))
      .returning();
    if (!p) return; // already processed (idempotent)
    // the invoice settles (and its effects run) exactly once, even if several payment attempts for it succeed
    const [inv] = await this.dbs.db
      .update(invoices)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(invoices.id, p.invoiceId), ne(invoices.status, 'paid'), ne(invoices.status, 'void')))
      .returning();
    if (!inv) {
      this.logger.error(`payment ${p.id} succeeded for an invoice that is already settled — needs a refund`);
      await this.dbs.db
        .update(payments)
        .set({ raw: sql`coalesce(${payments.raw}, '{}'::jsonb) || ${JSON.stringify({ duplicateSettlement: true, needsRefund: true })}::jsonb` })
        .where(eq(payments.id, p.id));
      return;
    }
    try {
      await this.applyEffects(inv);
    } catch (e) {
      this.logger.error(`effects for invoice ${inv.id} failed: ${(e as Error).stack}`);
    }
    if (inv.amountMinor > 0 && inv.userId) {
      await this.notify.notify({ userId: inv.userId, template: 'payment_succeeded', vars: { what: INVOICE_PURPOSE_LABELS_KA[inv.purpose], amount: formatMoney(inv.amountMinor) }, link: '/account/billing' });
    }
  }

  async markFailed(paymentId: string, reason: string) {
    const [p] = await this.dbs.db
      .update(payments)
      .set({ status: 'failed', raw: sql`coalesce(${payments.raw}, '{}'::jsonb) || ${JSON.stringify({ failReason: reason })}::jsonb` })
      .where(and(eq(payments.id, paymentId), inArray(payments.status, ['created', 'pending'])))
      .returning();
    if (!p) return;
    const [inv] = await this.dbs.db.update(invoices).set({ status: 'failed' }).where(and(eq(invoices.id, p.invoiceId), eq(invoices.status, 'open'))).returning();
    if (inv?.subscriptionId) {
      const sub = await this.dbs.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, inv.subscriptionId) });
      if (sub && sub.status !== 'pending') {
        await this.dbs.db.update(subscriptions).set({ failedAttempts: sub.failedAttempts + 1, status: sub.status === 'past_due' || sub.status === 'active' ? 'grace' : sub.status }).where(eq(subscriptions.id, sub.id));
      }
    }
    if (inv?.userId) await this.notify.notify({ userId: inv.userId, template: 'payment_failed', vars: { what: INVOICE_PURPOSE_LABELS_KA[inv.purpose], amount: formatMoney(inv.amountMinor) }, link: '/account/billing' });
  }

  /* ---------------- effects ---------------- */

  private async applyEffects(inv: InvoiceRow) {
    const custom = this.handlers.get(inv.purpose);
    if (custom) return custom(inv);
    switch (inv.purpose) {
      case 'subscription':
      case 'api':
        if (inv.subscriptionId) await this.activateSubscription(inv.subscriptionId);
        return;
      case 'vip': {
        const payment = await this.dbs.db.query.payments.findFirst({ where: eq(payments.invoiceId, inv.id) });
        const l = inv.refId ? await this.read.findRaw(inv.refId) : null;
        if (!l) return;
        const planKey = ((payment?.raw ?? {}) as { planKey?: string }).planKey ?? 'vip_30';
        const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, planKey) });
        const days = plan?.days ?? (planKey === 'vip_7' ? 7 : 30);
        const from = l.vipUntil && l.vipUntil > new Date() ? l.vipUntil : new Date();
        const until = new Date(from.getTime() + days * 86_400_000);
        await this.dbs.db.update(listings).set({ vipUntil: until }).where(eq(listings.id, l.id));
        await this.search.listingChanged(l.id);
        await this.notify.notify({ userId: inv.userId, template: 'vip_activated', vars: { title: l.title, until: formatDateKa(until) }, link: '/account/listings', channels: ['in_app'] });
        return;
      }
      case 'report':
        if (inv.refId) {
          await this.dbs.db.update(reportPurchases).set({ status: 'paid', invoiceId: inv.id }).where(eq(reportPurchases.id, inv.refId));
          await this.queue.add('billing.report', { purchaseId: inv.refId });
        }
        return;
      default:
        return;
    }
  }

  async activateSubscription(subId: string) {
    const sub = await this.dbs.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subId) });
    if (!sub) return;
    const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, sub.planKey) });
    const days = plan?.days ?? 30;
    const now = new Date();
    const continuing = (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'grace') && sub.periodEnd;
    const start = continuing && sub.periodEnd! > now ? sub.periodEnd! : continuing ? sub.periodEnd! : now;
    let end = new Date(start.getTime() + days * 86_400_000);
    if (end < now) end = new Date(now.getTime() + days * 86_400_000);
    await this.dbs.db
      .update(subscriptions)
      .set({ status: 'active', periodStart: continuing ? (sub.periodStart ?? now) : now, periodEnd: end, graceUntil: null, failedAttempts: 0, downgradedAt: null })
      .where(eq(subscriptions.id, sub.id));
    // cancel other active plans of the same audience for the same owner (plan switch)
    if (plan) {
      const sameAudience = (await this.dbs.db.select({ key: plans.key }).from(plans).where(eq(plans.audience, plan.audience))).map((p) => p.key).filter((k) => k !== plan.key);
      if (sameAudience.length) {
        await this.dbs.db
          .update(subscriptions)
          .set({ status: 'cancelled' })
          .where(and(sub.orgId ? eq(subscriptions.orgId, sub.orgId) : eq(subscriptions.userId, sub.userId!), inArray(subscriptions.planKey, sameAudience), inArray(subscriptions.status, ['active', 'past_due', 'grace', 'pending'])));
      }
    }
    if (sub.orgId && plan && plan.audience !== 'api') await this.dbs.db.update(organizations).set({ plan: plan.key }).where(eq(organizations.id, sub.orgId));
    if (plan?.audience === 'api') {
      const limits = { planKey: plan.key, rateLimitPerMin: plan.limits.perMin ?? 60, monthlyQuota: plan.limits.monthlyQuota ?? 10000 };
      await this.dbs.db.update(apiKeys).set(limits).where(sub.orgId ? eq(apiKeys.orgId, sub.orgId) : and(eq(apiKeys.userId, sub.userId!), isNull(apiKeys.orgId)));
    }
  }

  private async downgrade(sub: SubRow, status: 'expired' | 'cancelled') {
    await this.dbs.db.update(subscriptions).set({ status, downgradedAt: new Date() }).where(eq(subscriptions.id, sub.id));
    const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, sub.planKey) });
    if (sub.orgId && plan?.audience !== 'api') {
      const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, sub.orgId) });
      if (org?.plan === sub.planKey) await this.dbs.db.update(organizations).set({ plan: 'free' }).where(eq(organizations.id, sub.orgId));
    }
    if (plan?.audience === 'api') {
      await this.dbs.db.update(apiKeys).set({ planKey: 'api_trial', rateLimitPerMin: 10, monthlyQuota: 500 }).where(sub.orgId ? eq(apiKeys.orgId, sub.orgId) : and(eq(apiKeys.userId, sub.userId!), isNull(apiKeys.orgId)));
    }
  }

  /** Hourly: period end → renewal invoice + past_due (grace window) → expired + downgrade; cancel at period end. */
  async runLifecycle(now = new Date()) {
    const graceMs = (await this.graceHours()) * 3600_000;
    const due = await this.dbs.db.query.subscriptions.findMany({ where: and(eq(subscriptions.status, 'active'), lt(subscriptions.periodEnd, now), isNull(subscriptions.deletedAt)) });
    let renewed = 0;
    let expired = 0;
    for (const sub of due) {
      if (sub.cancelAtPeriodEnd) {
        await this.downgrade(sub, 'cancelled');
        expired++;
        continue;
      }
      const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, sub.planKey) });
      const graceUntil = new Date(sub.periodEnd!.getTime() + graceMs);
      await this.dbs.db.update(subscriptions).set({ status: 'past_due', graceUntil }).where(eq(subscriptions.id, sub.id));
      const payer = sub.userId ?? (await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, sub.orgId!), eq(memberships.role, 'manager'), eq(memberships.active, true)) }))?.userId;
      if (plan && payer) {
        const amount = plan.audience === 'agent' ? plan.priceMinor * sub.seats : plan.priceMinor;
        await this.createPayment({
          userId: payer, orgId: sub.orgId, purpose: plan.audience === 'api' ? 'api' : 'subscription', subscriptionId: sub.id, refId: sub.id, allowPromo: true, returnPath: '/account/billing',
          idempotencyKey: `renewal:${sub.id}:${sub.periodEnd!.toISOString().slice(0, 10)}`,
          lines: [{ name: `${plan.nameKa} — განახლება`, qty: 1, amountMinor: amount }], description: `${plan.nameKa} — განახლება`,
        });
        const after = await this.dbs.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub.id) });
        if (after?.status !== 'active') await this.notify.notify({ userId: payer, template: 'subscription_renewal', vars: { plan: plan.nameKa, amount: formatMoney(amount), until: formatDateKa(graceUntil) }, link: '/account/billing' });
      }
      renewed++;
    }
    const lapsed = await this.dbs.db.query.subscriptions.findMany({ where: and(inArray(subscriptions.status, ['past_due', 'grace']), lt(subscriptions.graceUntil, now), isNull(subscriptions.deletedAt)) });
    for (const sub of lapsed) {
      await this.downgrade(sub, 'expired');
      const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, sub.planKey) });
      const payer = sub.userId ?? (await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, sub.orgId!), eq(memberships.role, 'manager'), eq(memberships.active, true)) }))?.userId;
      if (payer) await this.notify.notify({ userId: payer, template: 'subscription_expired', vars: { plan: plan?.nameKa ?? sub.planKey }, link: '/pricing' });
      expired++;
    }
    return { renewed, expired };
  }

  /** Every 6h: failed payments get a fresh checkout link (max 3 attempts); subscriptions move into grace. */
  async retryFailed(now = new Date()) {
    const since = new Date(now.getTime() - 14 * 86_400_000);
    const failed = await this.dbs.db
      .select({ p: payments, inv: invoices })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(and(eq(payments.status, 'failed'), eq(invoices.status, 'failed'), gte(payments.createdAt, since), lt(payments.attempts, 3)));
    let retried = 0;
    for (const { p, inv } of failed) {
      if (!inv.userId) continue;
      const newer = await this.dbs.db.query.payments.findFirst({ where: and(eq(payments.invoiceId, inv.id), ne(payments.id, p.id), gt(payments.createdAt, p.createdAt)) });
      if (newer) continue;
      const paymentId = uuidv7();
      await this.dbs.db.update(invoices).set({ status: 'open' }).where(eq(invoices.id, inv.id));
      await this.dbs.db.insert(payments).values({ id: paymentId, invoiceId: inv.id, amountMinor: inv.amountMinor, provider: this.provider.name, idempotencyKey: `retry:${inv.id}:${p.attempts + 1}`, status: 'created', attempts: p.attempts + 1, raw: { ...((p.raw as object) ?? {}), retryOf: p.id } });
      try {
        const r = await this.provider.createCheckout({ paymentId, invoiceNumber: inv.number, amountMinor: inv.amountMinor, currency: inv.currency, description: inv.lines[0]?.name ?? 'lokacia.ge', returnUrl: `${this.env.APP_URL}${this.redirectPath(inv.id, '/account/billing')}` });
        await this.dbs.db.update(payments).set({ providerRef: r.providerRef, checkoutUrl: r.checkoutUrl, status: 'pending' }).where(eq(payments.id, paymentId));
        await this.notify.notify({ userId: inv.userId, template: 'payment_failed', vars: { what: INVOICE_PURPOSE_LABELS_KA[inv.purpose], amount: formatMoney(inv.amountMinor) }, link: `/checkout/mock/${paymentId}` });
        retried++;
      } catch (e) {
        this.logger.warn(`retry for invoice ${inv.id} failed: ${(e as Error).message}`);
        await this.dbs.db.update(payments).set({ status: 'failed' }).where(eq(payments.id, paymentId));
        await this.dbs.db.update(invoices).set({ status: 'failed' }).where(eq(invoices.id, inv.id));
      }
    }
    return { retried };
  }

  /* ---------------- reads ---------------- */

  async invoiceDto(inv: InvoiceRow): Promise<InvoiceDto> {
    const last = await this.dbs.db.query.payments.findFirst({ where: eq(payments.invoiceId, inv.id), orderBy: desc(payments.createdAt) });
    return {
      id: inv.id, number: inv.number, purpose: inv.purpose, lines: inv.lines, amountMinor: inv.amountMinor, currency: inv.currency, status: inv.status,
      dueAt: inv.dueAt?.toISOString() ?? null, paidAt: inv.paidAt?.toISOString() ?? null, createdAt: inv.createdAt.toISOString(), orgId: inv.orgId,
      lastPaymentId: last && last.provider !== 'promo' && last.status !== 'succeeded' ? last.id : null,
    };
  }

  async invoicesFor(user: AuthUser, limit = 100) {
    const orgIds = await this.managedOrgIds(user.id);
    const rows = await this.dbs.db
      .select()
      .from(invoices)
      .where(and(isNull(invoices.deletedAt), orgIds.length ? or(eq(invoices.userId, user.id), inArray(invoices.orgId, orgIds)) : eq(invoices.userId, user.id)))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    return Promise.all(rows.map((r) => this.invoiceDto(r)));
  }

  async invoice(user: AuthUser, id: string) {
    const inv = await this.dbs.db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (!inv || !(await this.canSeeInvoice(user, inv))) throw problems.notFound('ინვოისი');
    return inv;
  }

  async subscriptionDto(s: SubRow): Promise<SubscriptionDto> {
    const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, s.planKey) });
    const org = s.orgId ? await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, s.orgId) }) : null;
    return {
      id: s.id, planKey: s.planKey, planName: plan?.nameKa ?? s.planKey, priceMinor: plan?.priceMinor ?? 0, orgId: s.orgId, orgName: org?.name ?? null, status: s.status, seats: s.seats,
      periodStart: s.periodStart?.toISOString() ?? null, periodEnd: s.periodEnd?.toISOString() ?? null, graceUntil: s.graceUntil?.toISOString() ?? null, cancelAtPeriodEnd: s.cancelAtPeriodEnd, failedAttempts: s.failedAttempts,
    };
  }

  async subscriptionsFor(user: AuthUser) {
    const orgIds = await this.managedOrgIds(user.id);
    const rows = await this.dbs.db
      .select()
      .from(subscriptions)
      .where(and(isNull(subscriptions.deletedAt), orgIds.length ? or(eq(subscriptions.userId, user.id), inArray(subscriptions.orgId, orgIds)) : eq(subscriptions.userId, user.id)))
      .orderBy(desc(subscriptions.createdAt));
    return Promise.all(rows.filter((r) => r.status !== 'pending').map((r) => this.subscriptionDto(r)));
  }

  async setCancel(user: AuthUser, id: string, cancel: boolean) {
    const sub = await this.dbs.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) });
    if (!sub) throw problems.notFound('გამოწერა');
    if (sub.userId !== user.id) {
      if (!sub.orgId) throw problems.forbidden();
      await this.assertOrgManager(user, sub.orgId);
    }
    if (!['active', 'past_due', 'grace'].includes(sub.status)) throw problems.conflict('გამოწერა არ არის აქტიური');
    const [row] = await this.dbs.db.update(subscriptions).set({ cancelAtPeriodEnd: cancel }).where(eq(subscriptions.id, id)).returning();
    return this.subscriptionDto(row!);
  }

  async overview(user: AuthUser) {
    return {
      subscriptions: await this.subscriptionsFor(user),
      invoices: await this.invoicesFor(user),
      reports: await this.reports.mine(user.id),
      promoActive: await this.settings.promoActive(),
      promoUntil: (await this.settings.get<string | null>('launch_promo_until')) ?? null,
    };
  }

  async paymentSummary(user: AuthUser, paymentId: string): Promise<PaymentSummary> {
    const p = await this.dbs.db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!p) throw problems.notFound('გადახდა');
    const inv = await this.invoice(user, p.invoiceId);
    const raw = (p.raw ?? {}) as { returnPath?: string; description?: string };
    return {
      id: p.id, status: p.status, amountMinor: p.amountMinor, currency: inv.currency, provider: p.provider,
      invoice: { id: inv.id, number: inv.number, purpose: inv.purpose, lines: inv.lines, status: inv.status },
      description: raw.description ?? inv.lines[0]?.name ?? '', returnPath: raw.returnPath ?? '/account/billing',
    };
  }
}
