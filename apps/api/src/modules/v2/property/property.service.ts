import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  and, asc, desc, eq, inArray, isNull, leases, listingMedia, listings, lt, maintenanceRequests, notifications, or, rentInvoices, sql, users, utilityReadings,
} from '@lokacia/db';
import {
  MAINTENANCE_STATUS_LABELS_KA, RENT_STATUS_LABELS_KA, UTILITY_KIND_LABELS_KA, formatDateKa, formatMoney, normalizePhone, type LeaseDetailDto, type LeaseDto, type MaintenanceDto,
  type PropertyOverview, type RentInvoiceDto, type UtilityReadingDto,
} from '@lokacia/contracts';
import type { z } from 'zod';
import type { leaseCreateSchema, leaseUpdateSchema, maintenanceCreateSchema, utilityReadingSchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import type { AuthUser } from '../../../common/request';
import { BillingService } from '../../billing/billing.service';
import { createPdf, footer, heading, keyValues, paragraph, PDF_COLORS, toBuffer } from '../../billing/pdf';
import { ListingReadService } from '../../listings/listing-read.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { registerTemplates } from '../../notifications/templates';

type LeaseRow = typeof leases.$inferSelect;
type RentRow = typeof rentInvoices.$inferSelect;

registerTemplates({
  lease_message: { title: (v) => `შეტყობინება: ${v.listing}`, body: (v) => String(v.body ?? '') },
  rent_paid: { title: () => 'იჯარა გადახდილია', body: (v) => `${v.period}: ${v.amount} — ${v.listing}` },
  maintenance_new: { title: () => 'ახალი ტექნიკური მოთხოვნა', body: (v) => `${v.listing}: ${v.title}` },
});

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** V4 rent payments + V9 property management (owner portfolio, tenant side). */
@Injectable()
export class PropertyService implements OnModuleInit {
  private readonly logger = new Logger('Property');
  constructor(
    private readonly dbs: DbService,
    private readonly billing: BillingService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
    private readonly read: ListingReadService,
  ) {}

  onModuleInit() {
    this.billing.registerHandler('rent', async (inv) => {
      if (inv.refId) await this.markRentPaid(inv.refId, inv.id);
    });
    this.queue.register('v2.rent.generate', () => this.generateInvoices());
    this.queue.register('v2.rent.late', () => this.lateNotices());
    this.queue.register('v2.rent.autopay', () => this.autopay());
    this.queue.every('v2.rent.generate', 24 * 3600_000);
    this.queue.every('v2.rent.late', 24 * 3600_000);
    this.queue.every('v2.rent.autopay', 12 * 3600_000);
  }

  /* ---------------- access ---------------- */

  private roleOf(l: LeaseRow, user: AuthUser): 'owner' | 'tenant' | null {
    if (l.ownerId === user.id || user.role === 'admin') return 'owner';
    if (l.tenantId === user.id) return 'tenant';
    return null;
  }

  async lease(user: AuthUser, id: string) {
    const l = await this.dbs.db.query.leases.findFirst({ where: and(eq(leases.id, id), isNull(leases.deletedAt)) });
    const role = l ? this.roleOf(l, user) : null;
    if (!l || !role) throw problems.notFound('იჯარა');
    return { lease: l, role };
  }

  private rentDto(r: RentRow): RentInvoiceDto {
    return { id: r.id, leaseId: r.leaseId, period: r.period, amountMinor: r.amountMinor, penaltyMinor: r.penaltyMinor, totalMinor: r.amountMinor + r.penaltyMinor, dueOn: r.dueOn, status: r.status, paidAt: r.paidAt?.toISOString() ?? null, lateNoticeSentAt: r.lateNoticeSentAt?.toISOString() ?? null };
  }

  private async leaseDto(l: LeaseRow, role: 'owner' | 'tenant'): Promise<LeaseDto> {
    const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, l.listingId) });
    const cover = listing ? (await this.read.cards([listing.id]))[0]?.cover ?? null : null;
    const owner = await this.dbs.db.query.users.findFirst({ where: eq(users.id, l.ownerId) });
    const invs = await this.dbs.db.select().from(rentInvoices).where(and(eq(rentInvoices.leaseId, l.id), isNull(rentInvoices.deletedAt))).orderBy(asc(rentInvoices.dueOn));
    const unpaid = invs.filter((i) => i.status !== 'paid');
    const openMaint = await this.dbs.db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM maintenance_requests WHERE lease_id = ${l.id} AND status <> 'resolved' AND deleted_at IS NULL`);
    return {
      id: l.id, myRole: role,
      listing: { id: l.listingId, slug: listing?.slug ?? '', title: listing?.title ?? '', address: listing?.address ?? '', cover },
      ownerName: owner?.name ?? null, tenantName: l.tenantName, tenantPhone: l.tenantPhone, tenantUserId: l.tenantId,
      rentMinor: l.rentMinor, dayOfMonth: l.dayOfMonth, startsOn: l.startsOn, endsOn: l.endsOn, penaltyPctPerDay: l.penaltyPctPerDay, autopay: l.autopay, status: l.status,
      balanceDueMinor: unpaid.reduce((a, i) => a + i.amountMinor + i.penaltyMinor, 0), openMaintenance: Number(openMaint[0]?.n ?? 0),
      nextDue: unpaid[0] ? this.rentDto(unpaid[0]) : null,
    };
  }

  async overview(user: AuthUser): Promise<PropertyOverview> {
    const rows = await this.dbs.db.select().from(leases).where(and(isNull(leases.deletedAt), or(eq(leases.ownerId, user.id), eq(leases.tenantId, user.id)))).orderBy(desc(leases.createdAt));
    const dtos = await Promise.all(rows.map((l) => this.leaseDto(l, l.ownerId === user.id ? 'owner' : 'tenant')));
    const owned = dtos.filter((d) => d.myRole === 'owner' && d.status === 'active');
    const ownedIds = owned.map((d) => d.id);
    const period = periodOf(new Date());
    const collected = ownedIds.length
      ? await this.dbs.db.execute<{ s: string | null }>(sql`SELECT sum(amount_minor + penalty_minor) AS s FROM rent_invoices WHERE status = 'paid' AND period = ${period} AND lease_id = ANY(${`{${ownedIds.join(',')}}`}::uuid[])`)
      : [{ s: '0' }];
    const overdue = ownedIds.length
      ? await this.dbs.db.execute<{ s: string | null }>(sql`SELECT sum(amount_minor + penalty_minor) AS s FROM rent_invoices WHERE status = 'overdue' AND lease_id = ANY(${`{${ownedIds.join(',')}}`}::uuid[])`)
      : [{ s: '0' }];
    return {
      leases: dtos,
      totals: {
        monthlyRentMinor: owned.reduce((a, d) => a + d.rentMinor, 0),
        overdueMinor: Number(overdue[0]?.s ?? 0),
        openMaintenance: owned.reduce((a, d) => a + d.openMaintenance, 0),
        collectedThisMonthMinor: Number(collected[0]?.s ?? 0),
      },
    };
  }

  private maintenanceDto(m: typeof maintenanceRequests.$inferSelect, reporterName: string | null): MaintenanceDto {
    return { id: m.id, leaseId: m.leaseId, title: m.title, description: m.description, photos: m.photos, priority: m.priority, status: m.status, reporterName, createdAt: m.createdAt.toISOString(), resolvedAt: m.resolvedAt?.toISOString() ?? null };
  }

  async detail(user: AuthUser, id: string): Promise<LeaseDetailDto> {
    const { lease, role } = await this.lease(user, id);
    const base = await this.leaseDto(lease, role);
    const invs = await this.dbs.db.select().from(rentInvoices).where(and(eq(rentInvoices.leaseId, id), isNull(rentInvoices.deletedAt))).orderBy(desc(rentInvoices.period));
    const maint = await this.dbs.db.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.leaseId, id), isNull(maintenanceRequests.deletedAt))).orderBy(desc(maintenanceRequests.createdAt));
    const reporters = maint.map((m) => m.reporterId).filter((x): x is string => !!x);
    const names = reporters.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, reporters)) : [];
    const utils = await this.dbs.db.select().from(utilityReadings).where(and(eq(utilityReadings.leaseId, id), isNull(utilityReadings.deletedAt))).orderBy(desc(utilityReadings.period), asc(utilityReadings.kind));
    const msgs = await this.dbs.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.template, 'lease_message'), eq(notifications.channel, 'in_app'), sql`${notifications.payload}->>'leaseId' = ${id}`))
      .orderBy(asc(notifications.createdAt))
      .limit(200);
    return {
      ...base,
      invoices: invs.map((r) => this.rentDto(r)),
      maintenance: maint.map((m) => this.maintenanceDto(m, names.find((n) => n.id === m.reporterId)?.name ?? null)),
      utilities: utils.map((u): UtilityReadingDto => ({ id: u.id, kind: u.kind, period: u.period, reading: u.reading, amountMinor: u.amountMinor })),
      messages: msgs.map((m) => {
        const p = (m.payload ?? {}) as { fromUserId?: string; body?: string };
        return { id: m.id, fromMe: p.fromUserId === user.id, body: p.body ?? m.body ?? '', createdAt: m.createdAt.toISOString() };
      }),
    };
  }

  /* ---------------- leases ---------------- */

  async create(user: AuthUser, input: z.infer<typeof leaseCreateSchema>) {
    const l = await this.read.findRaw(input.listingId);
    if (!l) throw problems.notFound('განცხადება');
    if (l.ownerId !== user.id && !(await this.read.canManage(l, user))) throw problems.forbidden();
    const phone = input.tenantPhone ? normalizePhone(input.tenantPhone) : null;
    const tenant = phone ? await this.dbs.db.query.users.findFirst({ where: and(eq(users.phone, phone), isNull(users.deletedAt)) }) : null;
    const [row] = await this.dbs.db
      .insert(leases)
      .values({ listingId: l.id, ownerId: l.ownerId, tenantId: tenant?.id ?? null, tenantName: input.tenantName, tenantPhone: phone, rentMinor: input.rentMinor, dayOfMonth: input.dayOfMonth, startsOn: input.startsOn, endsOn: input.endsOn ?? null, penaltyPctPerDay: input.penaltyPctPerDay, autopay: input.autopay })
      .returning();
    await this.generateFor(row!);
    if (tenant) await this.notify.notify({ userId: tenant.id, template: 'generic', vars: { title: 'ახალი იჯარა', body: `„${l.title}“ — იჯარა დაემატა თქვენ ანგარიშზე.` }, link: `/account/property/leases/${row!.id}`, channels: ['in_app'] });
    return this.leaseDto(row!, 'owner');
  }

  async update(user: AuthUser, id: string, input: z.infer<typeof leaseUpdateSchema>, keys: string[]) {
    const { lease, role } = await this.lease(user, id);
    const patch = Object.fromEntries(Object.entries(input).filter(([k]) => keys.includes(k)));
    if (role === 'tenant' && Object.keys(patch).some((k) => k !== 'autopay')) throw problems.forbidden('მოიჯარე შეიძლება შეცვალოს მხოლოდ ავტოგადახდა');
    const [row] = await this.dbs.db.update(leases).set(patch).where(eq(leases.id, lease.id)).returning();
    return this.leaseDto(row!, role);
  }

  /* ---------------- rent ---------------- */

  private dueOn(period: string, day: number) {
    return `${period}-${String(Math.min(day, 28)).padStart(2, '0')}`;
  }

  private async generateFor(l: LeaseRow, now = new Date()) {
    if (l.status !== 'active') return 0;
    const period = periodOf(now);
    if (l.startsOn.slice(0, 7) > period || (l.endsOn && l.endsOn.slice(0, 7) < period)) return 0;
    const inserted = await this.dbs.db
      .insert(rentInvoices)
      .values({ leaseId: l.id, period, amountMinor: l.rentMinor, dueOn: this.dueOn(period, l.dayOfMonth), status: 'open' })
      .onConflictDoNothing()
      .returning();
    if (inserted.length && l.tenantId) {
      await this.notify.notify({ userId: l.tenantId, template: 'rent_due', vars: { period, amount: formatMoney(l.rentMinor), due: formatDateKa(inserted[0]!.dueOn) }, link: `/account/property/leases/${l.id}` });
    }
    return inserted.length;
  }

  /** Monthly invoices for all active leases (idempotent per lease × period). */
  async generateInvoices(now = new Date()) {
    const rows = await this.dbs.db.select().from(leases).where(and(eq(leases.status, 'active'), isNull(leases.deletedAt)));
    let created = 0;
    for (const l of rows) created += await this.generateFor(l, now);
    return { created };
  }

  /** Overdue marking, daily penalty (penalty_pct_per_day × days late) and one late notice per invoice. */
  async lateNotices(now = new Date()) {
    const d = now.toISOString().slice(0, 10);
    const rows = await this.dbs.db
      .select({ r: rentInvoices, l: leases })
      .from(rentInvoices)
      .innerJoin(leases, eq(leases.id, rentInvoices.leaseId))
      .where(and(inArray(rentInvoices.status, ['open', 'overdue']), lt(rentInvoices.dueOn, d), isNull(rentInvoices.deletedAt)));
    let notices = 0;
    for (const { r, l } of rows) {
      const daysLate = Math.max(0, Math.floor((new Date(`${d}T00:00:00Z`).getTime() - new Date(`${r.dueOn}T00:00:00Z`).getTime()) / DAY));
      const penaltyMinor = Math.round((r.amountMinor * l.penaltyPctPerDay * daysLate) / 100);
      const sendNotice = !r.lateNoticeSentAt;
      await this.dbs.db.update(rentInvoices).set({ status: 'overdue', penaltyMinor, ...(sendNotice ? { lateNoticeSentAt: now } : {}) }).where(eq(rentInvoices.id, r.id));
      if (sendNotice) {
        notices++;
        const vars = { period: r.period, amount: formatMoney(r.amountMinor), penalty: formatMoney(penaltyMinor) };
        if (l.tenantId) await this.notify.notify({ userId: l.tenantId, template: 'rent_late', vars, link: `/account/property/leases/${l.id}` });
        else if (l.tenantPhone) await this.notify.notify({ template: 'rent_late', vars, channels: ['sms'], to: { sms: l.tenantPhone } });
        await this.notify.notify({ userId: l.ownerId, template: 'rent_late', vars, link: `/account/property/leases/${l.id}`, channels: ['in_app'] });
      }
    }
    return { overdue: rows.length, notices };
  }

  /** Autopay: charge the tenant's saved card at the PSP for due invoices. */
  async autopay(now = new Date()) {
    const d = now.toISOString().slice(0, 10);
    const rows = await this.dbs.db
      .select({ r: rentInvoices, l: leases })
      .from(rentInvoices)
      .innerJoin(leases, eq(leases.id, rentInvoices.leaseId))
      .where(and(eq(leases.autopay, true), sql`${leases.tenantId} IS NOT NULL`, inArray(rentInvoices.status, ['open', 'overdue']), sql`${rentInvoices.dueOn} <= ${d}`));
    let charged = 0;
    for (const { r, l } of rows) {
      const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, l.listingId) });
      await this.billing.chargeOffSession({
        userId: l.tenantId!, purpose: 'rent', refId: r.id, idempotencyKey: `autopay:${r.id}`,
        lines: [{ name: `იჯარა ${r.period} — ${listing?.title ?? ''}`, qty: 1, amountMinor: r.amountMinor + r.penaltyMinor }], description: `იჯარა ${r.period}`,
      });
      charged++;
    }
    return { charged };
  }

  async pay(user: AuthUser, rentInvoiceId: string) {
    const r = await this.dbs.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.id, rentInvoiceId) });
    if (!r) throw problems.notFound('ინვოისი');
    const { lease } = await this.lease(user, r.leaseId);
    if (r.status === 'paid') throw problems.conflict('ინვოისი უკვე გადახდილია');
    const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, lease.listingId) });
    const total = r.amountMinor + r.penaltyMinor;
    const res = await this.billing.createPayment({
      userId: user.id, purpose: 'rent', refId: r.id, allowPromo: false, returnPath: `/account/property/leases/${lease.id}`, idempotencyKey: `rent:${r.id}:${total}:${user.id}`,
      lines: [{ name: `იჯარა ${r.period} — ${listing?.title ?? ''}`, qty: 1, amountMinor: r.amountMinor }, ...(r.penaltyMinor ? [{ name: 'ჯარიმა დაგვიანებისთვის', qty: 1, amountMinor: r.penaltyMinor }] : [])],
      description: `იჯარა ${r.period}`,
    });
    await this.dbs.db.update(rentInvoices).set({ invoiceId: res.invoiceId }).where(eq(rentInvoices.id, r.id));
    return res;
  }

  async markRentPaid(rentInvoiceId: string, invoiceId: string) {
    const [r] = await this.dbs.db.update(rentInvoices).set({ status: 'paid', paidAt: new Date(), invoiceId }).where(and(eq(rentInvoices.id, rentInvoiceId), sql`${rentInvoices.status} <> 'paid'`)).returning();
    if (!r) return;
    const l = await this.dbs.db.query.leases.findFirst({ where: eq(leases.id, r.leaseId) });
    const listing = l ? await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, l.listingId) }) : null;
    if (l) await this.notify.notify({ userId: l.ownerId, template: 'rent_paid', vars: { period: r.period, amount: formatMoney(r.amountMinor + r.penaltyMinor), listing: listing?.title ?? '' }, link: `/account/property/leases/${l.id}`, channels: ['in_app'] });
  }

  async receiptPdf(user: AuthUser, rentInvoiceId: string) {
    const r = await this.dbs.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.id, rentInvoiceId) });
    if (!r) throw problems.notFound('ინვოისი');
    const { lease } = await this.lease(user, r.leaseId);
    const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, lease.listingId) });
    const owner = await this.dbs.db.query.users.findFirst({ where: eq(users.id, lease.ownerId) });
    const paid = r.status === 'paid';
    const doc = createPdf(paid ? `ქვითარი — იჯარა ${r.period}` : `ინვოისი — იჯარა ${r.period}`, listing?.title ?? '');
    keyValues(doc, [
      ['მესაკუთრე', owner?.name ?? '—'],
      ['მოიჯარე', lease.tenantName],
      ['მისამართი', listing?.address ?? '—'],
      ['პერიოდი', r.period],
      ['გადახდის ვადა', formatDateKa(r.dueOn)],
      ['იჯარა', formatMoney(r.amountMinor)],
      ['ჯარიმა', formatMoney(r.penaltyMinor)],
      ['სულ', formatMoney(r.amountMinor + r.penaltyMinor)],
      ['სტატუსი', RENT_STATUS_LABELS_KA[r.status]],
      ...(r.paidAt ? ([['გადახდის თარიღი', formatDateKa(r.paidAt)]] as [string, string][]) : []),
    ]);
    heading(doc, paid ? 'გადახდა მიღებულია' : 'გადახდა');
    paragraph(doc, paid ? 'ქვითარი ფორმირდა lokacia.ge-ს ონლაინ გადახდის სისტემის მიერ.' : 'გადაიხადეთ ონლაინ: lokacia.ge → ჩემი ქონება.', { color: paid ? PDF_COLORS.green : PDF_COLORS.basalt });
    footer(doc);
    return toBuffer(doc);
  }

  async export(user: AuthUser, leaseId: string, format: 'csv' | 'xlsx') {
    const { lease, role } = await this.lease(user, leaseId);
    if (role !== 'owner') throw problems.forbidden();
    const invs = await this.dbs.db.select().from(rentInvoices).where(eq(rentInvoices.leaseId, lease.id)).orderBy(asc(rentInvoices.period));
    const utils = await this.dbs.db.select().from(utilityReadings).where(eq(utilityReadings.leaseId, lease.id)).orderBy(asc(utilityReadings.period));
    const header = ['ტიპი', 'პერიოდი', 'ვადა', 'თანხა (₾)', 'ჯარიმა (₾)', 'სულ (₾)', 'სტატუსი', 'გადახდის თარიღი'];
    const rows: (string | number)[][] = [
      ...invs.map((r) => ['იჯარა', r.period, r.dueOn, r.amountMinor / 100, r.penaltyMinor / 100, (r.amountMinor + r.penaltyMinor) / 100, RENT_STATUS_LABELS_KA[r.status], r.paidAt ? r.paidAt.toISOString().slice(0, 10) : '']),
      ...utils.map((u) => [UTILITY_KIND_LABELS_KA[u.kind], u.period, '', u.amountMinor / 100, 0, u.amountMinor / 100, '', '']),
    ];
    const name = `lokacia-lease-${lease.id.slice(0, 8)}`;
    if (format === 'csv') {
      const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
      const csv = `﻿${[header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`;
      return { buffer: Buffer.from(csv, 'utf8'), contentType: 'text/csv; charset=utf-8', filename: `${name}.csv` };
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'lokacia.ge';
    const ws = wb.addWorksheet('იჯარა');
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 18));
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${name}.xlsx` };
  }

  /* ---------------- maintenance, utilities, messages ---------------- */

  async addMaintenance(user: AuthUser, leaseId: string, input: z.infer<typeof maintenanceCreateSchema>) {
    const { lease, role } = await this.lease(user, leaseId);
    const photos: string[] = [];
    for (const p of input.photos) {
      if (/^[0-9a-f-]{36}$/i.test(p)) {
        const m = await this.dbs.db.query.listingMedia.findFirst({ where: and(eq(listingMedia.id, p), eq(listingMedia.uploaderId, user.id)) });
        if (m) photos.push(m.url);
      } else if (p.startsWith('/api/') || p.startsWith('https://')) photos.push(p);
    }
    const [row] = await this.dbs.db.insert(maintenanceRequests).values({ leaseId: lease.id, reporterId: user.id, title: input.title, description: input.description ?? null, priority: input.priority, photos }).returning();
    const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, lease.listingId) });
    const other = role === 'tenant' ? lease.ownerId : lease.tenantId;
    if (other) await this.notify.notify({ userId: other, template: 'maintenance_new', vars: { listing: listing?.title ?? '', title: input.title }, link: `/account/property/leases/${lease.id}`, channels: input.priority === 'urgent' ? ['in_app', 'sms'] : ['in_app'] });
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    return this.maintenanceDto(row!, me?.name ?? null);
  }

  async updateMaintenance(user: AuthUser, id: string, status: 'open' | 'in_progress' | 'resolved') {
    const m = await this.dbs.db.query.maintenanceRequests.findFirst({ where: eq(maintenanceRequests.id, id) });
    if (!m) throw problems.notFound('მოთხოვნა');
    const { lease, role } = await this.lease(user, m.leaseId);
    if (role !== 'owner') throw problems.forbidden('სტატუსს ცვლის მესაკუთრე');
    const [row] = await this.dbs.db.update(maintenanceRequests).set({ status, resolvedAt: status === 'resolved' ? new Date() : null }).where(eq(maintenanceRequests.id, id)).returning();
    const notifyId = m.reporterId && m.reporterId !== user.id ? m.reporterId : lease.tenantId;
    if (notifyId) await this.notify.notify({ userId: notifyId, template: 'maintenance_update', vars: { title: m.title, status: MAINTENANCE_STATUS_LABELS_KA[status] }, link: `/account/property/leases/${lease.id}`, channels: ['in_app'] });
    return this.maintenanceDto(row!, null);
  }

  async addUtility(user: AuthUser, leaseId: string, input: z.infer<typeof utilityReadingSchema>) {
    const { lease, role } = await this.lease(user, leaseId);
    if (role !== 'owner') throw problems.forbidden();
    const [row] = await this.dbs.db.insert(utilityReadings).values({ leaseId: lease.id, kind: input.kind, period: input.period, reading: input.reading ?? null, amountMinor: input.amountMinor }).returning();
    return { id: row!.id, kind: row!.kind, period: row!.period, reading: row!.reading, amountMinor: row!.amountMinor } satisfies UtilityReadingDto;
  }

  async message(user: AuthUser, leaseId: string, body: string) {
    const { lease, role } = await this.lease(user, leaseId);
    const listing = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, lease.listingId) });
    const vars = { leaseId: lease.id, fromUserId: user.id, body, listing: listing?.title ?? '' };
    const link = `/account/property/leases/${lease.id}`;
    let ids: string[];
    if (role === 'owner') {
      ids = lease.tenantId
        ? await this.notify.notify({ userId: lease.tenantId, template: 'lease_message', vars, link, channels: ['in_app'] })
        : await this.notify.notify({ template: 'lease_message', vars, link, channels: ['in_app', ...(lease.tenantPhone ? (['sms'] as const) : [])], to: lease.tenantPhone ? { sms: lease.tenantPhone } : undefined });
    } else ids = await this.notify.notify({ userId: lease.ownerId, template: 'lease_message', vars, link, channels: ['in_app'] });
    return { id: ids[0] ?? '', fromMe: true, body, createdAt: new Date().toISOString() };
  }

  todayIso() {
    return today();
  }
}
