import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { and, desc, eq, financeApplications, financeProducts, isNull, listings, users, webhookEvents } from '@lokacia/db';
import { FINANCE_STATUS_LABELS_KA, formatMoney, type FinanceApplicationDto, type FinanceProductDto, type FinanceProductInput } from '@lokacia/contracts';
import type { z } from 'zod';
import type { financeApplicationSchema } from '@lokacia/contracts';
import { ENV, type Env } from '../../../config/env';
import { DbService } from '../../../common/db.service';
import { problems, ProblemException } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import type { AuthUser } from '../../../common/request';
import { NotificationsService } from '../../notifications/notifications.service';
import { registerTemplates } from '../../notifications/templates';

registerTemplates({
  finance_status: { title: () => 'ფინანსური განაცხადის სტატუსი', body: (v) => `${v.product}: ${v.status}` },
});

type ProductRow = typeof financeProducts.$inferSelect;
type AppRow = typeof financeApplications.$inferSelect;

/** Partner handoff adapter (bank/leasing/insurer API). Mock accepts everything and returns a reference. */
export interface FinancePartnerAdapter {
  submit(app: { id: string; productName: string; partner: string; amountMinor: number; termMonths: number | null; applicant: { name: string | null; phone: string | null }; payload: Record<string, unknown> }): Promise<{ ref: string }>;
}
export class MockFinancePartner implements FinancePartnerAdapter {
  async submit(app: { id: string }) {
    return { ref: `partner-${app.id.slice(-8)}` };
  }
}

/** V10 finance marketplace: products, consented applications, partner handoff, status webhooks, commission. */
@Injectable()
export class FinanceService implements OnModuleInit {
  private readonly logger = new Logger('Finance');
  private readonly partner: FinancePartnerAdapter = new MockFinancePartner();
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('v2.finance.handoff', (d: { id: string }) => this.handoff(d.id));
  }

  productDto(p: ProductRow): FinanceProductDto {
    return { id: p.id, partner: p.partner, kind: p.kind, name: p.name, description: p.description, rateText: p.rateText, minAmountMinor: p.minAmountMinor, maxAmountMinor: p.maxAmountMinor, commissionPct: p.commissionPct, active: p.active };
  }

  async products(includeInactive = false) {
    const rows = await this.dbs.db.select().from(financeProducts).where(includeInactive ? isNull(financeProducts.deletedAt) : and(isNull(financeProducts.deletedAt), eq(financeProducts.active, true))).orderBy(financeProducts.kind, financeProducts.name);
    return rows.map((r) => this.productDto(r));
  }

  async createProduct(input: FinanceProductInput) {
    const [row] = await this.dbs.db.insert(financeProducts).values({ ...input, rateText: input.rateText ?? null, minAmountMinor: input.minAmountMinor ?? null, maxAmountMinor: input.maxAmountMinor ?? null }).returning();
    return this.productDto(row!);
  }

  async updateProduct(id: string, patch: Partial<FinanceProductInput>) {
    const [row] = await this.dbs.db.update(financeProducts).set(patch).where(and(eq(financeProducts.id, id), isNull(financeProducts.deletedAt))).returning();
    if (!row) throw problems.notFound('პროდუქტი');
    return this.productDto(row);
  }

  async deleteProduct(id: string) {
    await this.dbs.db.update(financeProducts).set({ deletedAt: new Date(), active: false }).where(eq(financeProducts.id, id));
    return { ok: true };
  }

  async appDto(a: AppRow, withApplicant = false): Promise<FinanceApplicationDto> {
    const p = await this.dbs.db.query.financeProducts.findFirst({ where: eq(financeProducts.id, a.productId) });
    const l = a.listingId ? await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, a.listingId) }) : null;
    const u = withApplicant ? await this.dbs.db.query.users.findFirst({ where: eq(users.id, a.userId) }) : null;
    return {
      id: a.id, product: { id: a.productId, name: p?.name ?? '', partner: p?.partner ?? '', kind: p?.kind ?? 'fitout_loan' }, listing: l ? { id: l.id, slug: l.slug, title: l.title } : null,
      amountMinor: a.amountMinor, termMonths: a.termMonths, status: a.status, partnerRef: a.partnerRef, commissionMinor: a.commissionMinor, consentAt: a.consentAt.toISOString(), createdAt: a.createdAt.toISOString(),
      ...(u ? { applicant: { id: u.id, name: u.name, phone: u.phone } } : {}),
    };
  }

  async apply(user: AuthUser, input: z.infer<typeof financeApplicationSchema>) {
    const p = await this.dbs.db.query.financeProducts.findFirst({ where: and(eq(financeProducts.id, input.productId), eq(financeProducts.active, true), isNull(financeProducts.deletedAt)) });
    if (!p) throw problems.notFound('პროდუქტი');
    if (p.minAmountMinor != null && input.amountMinor < p.minAmountMinor) throw new ProblemException(422, 'amount-range', 'თანხა ნაკლებია მინიმალურზე', formatMoney(p.minAmountMinor), { errors: [{ path: 'amountMinor', message: `მინიმუმ ${formatMoney(p.minAmountMinor)}` }] });
    if (p.maxAmountMinor != null && input.amountMinor > p.maxAmountMinor) throw new ProblemException(422, 'amount-range', 'თანხა აღემატება მაქსიმალურს', formatMoney(p.maxAmountMinor), { errors: [{ path: 'amountMinor', message: `მაქსიმუმ ${formatMoney(p.maxAmountMinor)}` }] });
    const [row] = await this.dbs.db
      .insert(financeApplications)
      .values({ productId: p.id, userId: user.id, listingId: input.listingId ?? null, amountMinor: input.amountMinor, termMonths: input.termMonths ?? null, consentAt: new Date(), status: 'submitted', payload: { companyName: input.companyName ?? null, phone: input.phone ?? null, message: input.message ?? null, consentText: 'თანხმობა მონაცემების პარტნიორისთვის გადაცემაზე' } })
      .returning();
    await this.queue.add('v2.finance.handoff', { id: row!.id });
    return this.appDto(row!);
  }

  async handoff(id: string) {
    const a = await this.dbs.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, id) });
    if (!a || a.status !== 'submitted') return;
    const p = await this.dbs.db.query.financeProducts.findFirst({ where: eq(financeProducts.id, a.productId) });
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, a.userId) });
    const { ref } = await this.partner.submit({ id: a.id, productName: p?.name ?? '', partner: p?.partner ?? '', amountMinor: a.amountMinor, termMonths: a.termMonths, applicant: { name: u?.name ?? null, phone: u?.phone ?? null }, payload: (a.payload ?? {}) as Record<string, unknown> });
    await this.dbs.db.update(financeApplications).set({ status: 'sent', partnerRef: ref }).where(eq(financeApplications.id, a.id));
    await this.notify.notify({ userId: a.userId, template: 'finance_status', vars: { product: p?.name ?? '', status: FINANCE_STATUS_LABELS_KA.sent }, link: '/account/billing', channels: ['in_app'] });
  }

  async mine(user: AuthUser) {
    const rows = await this.dbs.db.select().from(financeApplications).where(eq(financeApplications.userId, user.id)).orderBy(desc(financeApplications.createdAt));
    return Promise.all(rows.map((r) => this.appDto(r)));
  }

  async all() {
    const rows = await this.dbs.db.select().from(financeApplications).orderBy(desc(financeApplications.createdAt)).limit(300);
    return Promise.all(rows.map((r) => this.appDto(r, true)));
  }

  private secret(partner: string) {
    return createHmac('sha256', this.env.PAYMENTS_WEBHOOK_SECRET).update(`finance:${partner}`).digest('hex');
  }

  signPartner(partner: string, body: string) {
    return createHmac('sha256', this.secret(partner)).update(body).digest('hex');
  }

  /** Partner status webhook: HMAC(body), dedupe by event id, commission on approval. */
  async webhook(partner: string, headers: Record<string, string | string[] | undefined>, raw: string) {
    const sig = String(headers['x-signature'] ?? '');
    const expected = this.signPartner(partner, raw);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new ProblemException(401, 'invalid-signature', 'ხელმოწერა არასწორია');
    const body = JSON.parse(raw) as { eventId: string; ref: string; status: 'approved' | 'rejected'; approvedAmountMinor?: number };
    const ins = await this.dbs.db.insert(webhookEvents).values({ provider: `finance:${partner}`, eventId: body.eventId, payload: body }).onConflictDoNothing().returning({ id: webhookEvents.id });
    if (!ins.length) return { ok: true, duplicate: true };
    const a = await this.dbs.db.query.financeApplications.findFirst({ where: eq(financeApplications.partnerRef, body.ref) });
    if (a && (a.status === 'sent' || a.status === 'submitted')) {
      const p = await this.dbs.db.query.financeProducts.findFirst({ where: eq(financeProducts.id, a.productId) });
      const amount = body.approvedAmountMinor ?? a.amountMinor;
      const commissionMinor = body.status === 'approved' ? Math.round((amount * (p?.commissionPct ?? 0)) / 100) : null;
      await this.dbs.db.update(financeApplications).set({ status: body.status, commissionMinor, ...(body.status === 'approved' ? { amountMinor: amount } : {}) }).where(eq(financeApplications.id, a.id));
      await this.notify.notify({ userId: a.userId, template: 'finance_status', vars: { product: p?.name ?? '', status: FINANCE_STATUS_LABELS_KA[body.status] }, link: '/account/billing' });
    }
    await this.dbs.db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, ins[0]!.id));
    return { ok: true, duplicate: false, matched: !!a };
  }

  /** Non-production: admin simulates the partner decision through the real signed webhook path. */
  async simulate(id: string, status: 'approved' | 'rejected', approvedAmountMinor?: number) {
    if (this.env.NODE_ENV === 'production') throw problems.forbidden();
    const a = await this.dbs.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, id) });
    if (!a) throw problems.notFound('განაცხადი');
    if (a.status === 'submitted') await this.handoff(a.id);
    const fresh = await this.dbs.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, id) });
    if (!fresh?.partnerRef) throw problems.conflict('განაცხადი არ არის გაგზავნილი პარტნიორთან');
    const raw = JSON.stringify({ eventId: `sim_${uuidv7()}`, ref: fresh.partnerRef, status, approvedAmountMinor });
    await this.webhook('mock', { 'x-signature': this.signPartner('mock', raw) }, raw);
    return this.appDto((await this.dbs.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, id) }))!, true);
  }
}
