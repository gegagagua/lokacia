import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { desc, eq, escrowAccounts, invoices, ledgerEntries, listings, offers, or, sql, users } from '@lokacia/db';
import { ESCROW_STATUS_LABELS_KA, canEscrowTransition, formatDateKa, formatMoney, type EscrowDto, type EscrowStatus, type LedgerReconciliation } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import type { AuthUser } from '../../../common/request';
import { ESIGN, type ESignProvider } from '../../../integrations/esign/esign';
import { PAYMENTS, type PaymentProvider } from '../../../integrations/payments/payments';
import { STORAGE, type Storage } from '../../../integrations/storage/storage';
import { NotificationsService } from '../../notifications/notifications.service';
import { BillingService, MAX_INVOICE_MINOR } from '../../billing/billing.service';
import { createPdf, footer, heading, keyValues, paragraph, PDF_COLORS, toBuffer } from '../../billing/pdf';

type EscrowRow = typeof escrowAccounts.$inferSelect;

/** V3: digital contract + deposit escrow state machine with double-entry ledger. */
@Injectable()
export class EscrowService implements OnModuleInit {
  private readonly logger = new Logger('Escrow');
  constructor(
    private readonly dbs: DbService,
    private readonly billing: BillingService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
    @Inject(ESIGN) private readonly esign: ESignProvider,
    @Inject(PAYMENTS) private readonly payments: PaymentProvider,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  onModuleInit() {
    this.billing.registerHandler('escrow', async (inv) => {
      if (!inv.refId) return;
      const e = await this.dbs.db.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.id, inv.refId) });
      if (e && e.status !== 'pending') {
        // a second deposit for an escrow that is already funded/closed: never re-post the ledger, flag for refund
        this.logger.error(`escrow ${e.id} is ${e.status}; payment for invoice ${inv.id} needs a refund`);
        return;
      }
      await this.transition(inv.refId, 'funded', null, { memo: 'დეპოზიტის ჩარიცხვა', invoiceId: inv.id });
    });
    this.queue.register('v2.ledger.reconcile', () => this.reconcile());
    this.queue.every('v2.ledger.reconcile', 24 * 3600_000);
  }

  private async row(id: string) {
    const e = await this.dbs.db.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.id, id) });
    if (!e) throw problems.notFound('ესქროუ');
    return e;
  }

  private roleOf(e: EscrowRow, user: AuthUser): EscrowDto['myRole'] | null {
    if (e.tenantId === user.id) return 'tenant';
    if (e.ownerId === user.id) return 'owner';
    if (user.role === 'admin' || user.role === 'moderator') return 'admin';
    return null;
  }

  async dto(e: EscrowRow, user: AuthUser): Promise<EscrowDto> {
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, e.listingId) });
    const t = await this.dbs.db.query.users.findFirst({ where: eq(users.id, e.tenantId) });
    const o = await this.dbs.db.query.users.findFirst({ where: eq(users.id, e.ownerId) });
    return {
      id: e.id, offerId: e.offerId, listing: { id: e.listingId, slug: l?.slug ?? '', title: l?.title ?? '' }, tenant: { id: e.tenantId, name: t?.name ?? null }, owner: { id: e.ownerId, name: o?.name ?? null },
      myRole: this.roleOf(e, user) ?? 'admin', amountMinor: e.amountMinor, status: e.status, provider: e.provider,
      contractUrl: `/api/v1/escrow/${e.id}/contract.pdf`, tenantSignedAt: e.tenantSignedAt?.toISOString() ?? null, ownerSignedAt: e.ownerSignedAt?.toISOString() ?? null,
      disputeReason: e.disputeReason, history: e.history, createdAt: e.createdAt.toISOString(),
    };
  }

  async get(user: AuthUser, id: string) {
    const e = await this.row(id);
    if (!this.roleOf(e, user)) throw problems.notFound('ესქროუ');
    return e;
  }

  async mine(user: AuthUser) {
    const rows = await this.dbs.db.select().from(escrowAccounts).where(or(eq(escrowAccounts.tenantId, user.id), eq(escrowAccounts.ownerId, user.id))).orderBy(desc(escrowAccounts.createdAt));
    return Promise.all(rows.map((r) => this.dto(r, user)));
  }

  async all(user: AuthUser, status?: string) {
    const rows = await this.dbs.db.select().from(escrowAccounts).where(status ? eq(escrowAccounts.status, status as EscrowStatus) : sql`true`).orderBy(desc(escrowAccounts.updatedAt)).limit(200);
    return Promise.all(rows.map((r) => this.dto(r, user)));
  }

  async create(user: AuthUser, offerId: string) {
    const offer = await this.dbs.db.query.offers.findFirst({ where: eq(offers.id, offerId) });
    if (!offer || (offer.fromUserId !== user.id && offer.toUserId !== user.id)) throw problems.notFound('შეთავაზება');
    if (offer.status !== 'accepted') throw problems.conflict('ესქროუ იქმნება მხოლოდ მიღებული შეთავაზებაზე');
    const existing = await this.dbs.db.query.escrowAccounts.findFirst({ where: eq(escrowAccounts.offerId, offer.id) });
    if (existing) return existing;
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, offer.listingId) });
    if (!l) throw problems.notFound('განცხადება');
    const ownerId = l.ownerId;
    const tenantId = offer.fromUserId === ownerId ? offer.toUserId : offer.fromUserId;
    const amountMinor = Math.round(offer.priceMinor * Math.max(1, l.depositMonths || 1));
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_INVOICE_MINOR) throw problems.badRequest('დეპოზიტის თანხა არასწორია');
    const id = uuidv7();
    // one escrow per offer, even under concurrent requests (no unique index yet → transaction-scoped advisory lock)
    const created = await this.dbs.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`escrow:offer:${offer.id}`}))`);
      const [again] = await tx.select().from(escrowAccounts).where(eq(escrowAccounts.offerId, offer.id)).limit(1);
      if (again) return { row: again, isNew: false };
      const [row] = await tx
        .insert(escrowAccounts)
        .values({ id, offerId: offer.id, listingId: l.id, tenantId, ownerId, amountMinor, status: 'pending', provider: this.payments.name, contractUrl: `/api/v1/escrow/${id}/contract.pdf`, history: [] })
        .returning();
      return { row: row!, isNew: true };
    });
    if (!created.isNew) return created.row;
    const tenant = await this.dbs.db.query.users.findFirst({ where: eq(users.id, tenantId) });
    const sent = await this.esign.send({ id, title: `იჯარის ხელშეკრულება — ${l.title}`, signerName: tenant?.name ?? 'მოიჯარე', signerPhone: tenant?.phone });
    const [row] = await this.dbs.db.update(escrowAccounts).set({ esignRef: sent.ref }).where(eq(escrowAccounts.id, id)).returning();
    for (const uid of [tenantId, ownerId]) {
      await this.notify.notify({ userId: uid, template: 'escrow_update', vars: { status: `ხელშეკრულება მზად არის ხელმოსაწერად: ${l.title}` }, link: '/account/billing', channels: ['in_app'] });
    }
    return row!;
  }

  async sign(user: AuthUser, id: string) {
    const e = await this.get(user, id);
    const role = this.roleOf(e, user);
    if (role === 'admin') throw problems.forbidden('ხელს აწერს მხოლოდ მხარე');
    if (e.status !== 'pending') throw problems.conflict('ხელშეკრულება უკვე ხელმოწერილია');
    const patch = role === 'tenant' ? { tenantSignedAt: e.tenantSignedAt ?? new Date() } : { ownerSignedAt: e.ownerSignedAt ?? new Date() };
    const [row] = await this.dbs.db.update(escrowAccounts).set(patch).where(eq(escrowAccounts.id, id)).returning();
    const other = role === 'tenant' ? e.ownerId : e.tenantId;
    await this.notify.notify({ userId: other, template: 'escrow_update', vars: { status: row!.tenantSignedAt && row!.ownerSignedAt ? 'ხელშეკრულება ხელმოწერილია ორივე მხარის მიერ' : 'მეორე მხარე ხელს აწერა ხელშეკრულებას' }, link: '/account/billing', channels: ['in_app'] });
    return row!;
  }

  async fund(user: AuthUser, id: string) {
    const e = await this.get(user, id);
    if (this.roleOf(e, user) !== 'tenant') throw problems.forbidden('დეპოზიტს ჩარიცხავს მოიჯარე');
    if (e.status !== 'pending') throw problems.conflict('დეპოზიტი უკვე ჩარიცხულია');
    if (!e.tenantSignedAt || !e.ownerSignedAt) throw problems.conflict('ჯერ ორივე მხარე ხელს უნდა აწერს ხელშეკრულებას');
    if (e.invoiceId) {
      // an unpaid checkout already exists → return it instead of issuing a second deposit invoice (double charge)
      const open = await this.billing.openCheckout(e.invoiceId);
      if (open) return open;
    }
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, e.listingId) });
    const res = await this.billing.createPayment({
      userId: user.id, purpose: 'escrow', refId: e.id, allowPromo: false, returnPath: '/account/billing', idempotencyKey: `escrow:${e.id}:${e.invoiceId ?? 'first'}`,
      lines: [{ name: `დეპოზიტი (ესქროუ) — ${l?.title ?? ''}`, qty: 1, amountMinor: e.amountMinor }], description: `დეპოზიტი — ${l?.title ?? ''}`,
    });
    await this.dbs.db.update(escrowAccounts).set({ invoiceId: res.invoiceId }).where(eq(escrowAccounts.id, e.id));
    return res;
  }

  /** Ledger postings per transition (debits = credits in every tx). */
  private postings(e: EscrowRow, to: EscrowStatus): { account: string; debit: number; credit: number }[] {
    const a = e.amountMinor;
    if (to === 'funded') return [{ account: 'escrow:held', debit: a, credit: 0 }, { account: 'psp:clearing', debit: 0, credit: a }];
    if (to === 'released') return [{ account: `payable:owner:${e.ownerId}`, debit: a, credit: 0 }, { account: 'escrow:held', debit: 0, credit: a }];
    if (to === 'refunded') return [{ account: `payable:tenant:${e.tenantId}`, debit: a, credit: 0 }, { account: 'escrow:held', debit: 0, credit: a }];
    return [];
  }

  async transition(id: string, to: EscrowStatus, by: AuthUser | null, extra: { memo?: string; reason?: string; invoiceId?: string } = {}) {
    const updated = await this.dbs.db.transaction(async (tx) => {
      const [e] = await tx.select().from(escrowAccounts).where(eq(escrowAccounts.id, id)).for('update');
      if (!e) throw problems.notFound('ესქროუ');
      if (e.status === to) return null;
      if (!canEscrowTransition(e.status, to)) throw problems.invalidTransition(e.status, to);
      const txId = uuidv7();
      const posts = this.postings(e, to);
      if (posts.length) {
        await tx.insert(ledgerEntries).values(posts.map((p) => ({ txId, account: p.account, debitMinor: p.debit, creditMinor: p.credit, refType: 'escrow', refId: e.id, memo: extra.memo ?? `${e.status} → ${to}` })));
      }
      const history = [...e.history, { from: e.status, to, at: new Date().toISOString(), by: by?.id }];
      const [row] = await tx
        .update(escrowAccounts)
        .set({ status: to, history, ...(extra.reason ? { disputeReason: extra.reason } : {}), ...(extra.invoiceId ? { invoiceId: extra.invoiceId } : {}) })
        .where(eq(escrowAccounts.id, id))
        .returning();
      return row!;
    });
    if (!updated) return this.row(id);
    if (to === 'refunded' && updated.providerRef && this.payments.refund) {
      await this.payments.refund(updated.providerRef, updated.amountMinor).catch((err: Error) => this.logger.warn(`refund failed: ${err.message}`));
    }
    for (const uid of [updated.tenantId, updated.ownerId]) {
      await this.notify.notify({ userId: uid, template: 'escrow_update', vars: { status: `${ESCROW_STATUS_LABELS_KA[to]} — ${formatMoney(updated.amountMinor)}` }, link: '/account/billing', channels: ['in_app'] });
    }
    return updated;
  }

  async release(user: AuthUser, id: string) {
    const e = await this.get(user, id);
    if (this.roleOf(e, user) !== 'tenant') throw problems.forbidden('თანხას მესაკუთრეს გადასცემს მოიჯარე');
    return this.transition(id, 'released', user, { memo: 'დეპოზიტი გადაეცა მესაკუთრეს' });
  }

  async refund(user: AuthUser, id: string) {
    const e = await this.get(user, id);
    if (this.roleOf(e, user) !== 'owner') throw problems.forbidden('დეპოზიტს მოიჯარეს აბრუნებს მესაკუთრე');
    return this.transition(id, 'refunded', user, { memo: 'დეპოზიტი დაბრუნდა მოიჯარეს' });
  }

  async dispute(user: AuthUser, id: string, reason: string) {
    const e = await this.get(user, id);
    if (this.roleOf(e, user) === 'admin') throw problems.forbidden();
    return this.transition(id, 'disputed', user, { reason });
  }

  async resolve(admin: AuthUser, id: string, outcome: 'release' | 'refund', note: string) {
    const e = await this.row(id);
    if (e.status !== 'disputed') throw problems.conflict('ესქროუ არ არის დავის სტატუსში');
    return this.transition(id, outcome === 'release' ? 'released' : 'refunded', admin, { memo: `დავის გადაწყვეტა: ${note}` });
  }

  async reconcile(): Promise<LedgerReconciliation> {
    const txs = await this.dbs.db.execute<{ tx_id: string; d: string; c: string }>(sql`SELECT tx_id, sum(debit_minor) AS d, sum(credit_minor) AS c FROM ledger_entries WHERE deleted_at IS NULL GROUP BY tx_id`);
    const unbalanced = txs.filter((t) => Number(t.d) !== Number(t.c)).map((t) => ({ txId: t.tx_id, debitMinor: Number(t.d), creditMinor: Number(t.c) }));
    const bal = await this.dbs.db.execute<{ account: string; b: string }>(sql`
      SELECT CASE WHEN account LIKE 'payable:%' THEN split_part(account, ':', 1) || ':' || split_part(account, ':', 2) ELSE account END AS account, sum(debit_minor - credit_minor) AS b
      FROM ledger_entries WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1`);
    const held = await this.dbs.db.execute<{ s: string | null }>(sql`SELECT sum(amount_minor) AS s FROM escrow_accounts WHERE status IN ('funded','disputed') AND deleted_at IS NULL`);
    const balances = bal.map((b) => ({ account: b.account, balanceMinor: Number(b.b) }));
    const heldLedger = balances.find((b) => b.account === 'escrow:held')?.balanceMinor ?? 0;
    const ok = unbalanced.length === 0 && heldLedger === Number(held[0]?.s ?? 0);
    if (!ok) this.logger.warn(`ledger reconciliation mismatch: ${unbalanced.length} unbalanced tx, held ${heldLedger} vs ${held[0]?.s}`);
    return { checkedTx: txs.length, unbalanced, balances, ok };
  }

  async contractPdf(user: AuthUser, id: string) {
    const e = await this.get(user, id);
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, e.listingId) });
    const offer = await this.dbs.db.query.offers.findFirst({ where: eq(offers.id, e.offerId) });
    const t = await this.dbs.db.query.users.findFirst({ where: eq(users.id, e.tenantId) });
    const o = await this.dbs.db.query.users.findFirst({ where: eq(users.id, e.ownerId) });
    const doc = createPdf('იჯარის ხელშეკრულება და დეპოზიტის ესქროუ', `№ ${e.id.slice(0, 8).toUpperCase()} · ${formatDateKa(e.createdAt)}`);
    paragraph(doc, 'დემო-ტექსტი: იურიდიული ტექსტი საჭიროებს იურისტის განხილვას.', { color: PDF_COLORS.brick, size: 9 });
    heading(doc, 'მხარეები');
    keyValues(doc, [
      ['მესაკუთრე', o?.name ?? '—'],
      ['მოიჯარე', t?.name ?? '—'],
    ]);
    heading(doc, 'ობიექტი და პირობები');
    keyValues(doc, [
      ['ფართი', l?.title ?? '—'],
      ['მისამართი', l?.address ?? '—'],
      ['თვიური იჯარა', offer ? formatMoney(offer.priceMinor) : '—'],
      ['ვადა', offer ? `${offer.termMonths} თვე` : '—'],
      ['უფასო თვეები', offer ? String(offer.freeMonths) : '—'],
      ['დეპოზიტი (ესქროუ)', formatMoney(e.amountMinor)],
    ]);
    heading(doc, 'ესქროუს წესები');
    paragraph(doc, '1. მოიჯარე დეპოზიტს ჩარიცხავს ნეიტრალურ ანგარიშზე გადახდის პროვაიდერის მეშვეობით.\n2. ფართის გადაცემის შემდეგ მოიჯარე ადასტურებს, და თანხა გადაეცემა მესაკუთრეს.\n3. ხელშეკრულების გაუქმების შემთხვევაში მესაკუთრე დეპოზიტს აბრუნებს მოიჯარეს.\n4. დავის შემთხვევაში თანხა რჩება ესქროუზე, lokacia.ge-ს მოდერატორი იღებს გადაწყვეტას.');
    heading(doc, 'ხელმოწერები');
    keyValues(doc, [
      ['მესაკუთრე', e.ownerSignedAt ? `ხელმოწერილია ${formatDateKa(e.ownerSignedAt)}` : 'ხელმოწერის მოლოდინში'],
      ['მოიჯარე', e.tenantSignedAt ? `ხელმოწერილია ${formatDateKa(e.tenantSignedAt)}` : 'ხელმოწერის მოლოდინში'],
      ['სტატუსი', ESCROW_STATUS_LABELS_KA[e.status]],
    ]);
    footer(doc);
    void this.storage;
    void invoices;
    return toBuffer(doc);
  }
}
