import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, crmContacts, desc, eq, inArray, isNull, listings, organizations, presentations, sql, users } from '@lokacia/db';
import {
  DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, formatMoney, formatNumber, PASSPORT_FIELDS, type PresentationCreate, type PresentationRow, type PublicPresentation, type PublicPresentationListing,
} from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ENV, type Env } from '../../../config/env';
import { ListingReadService } from '../../listings/listing-read.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import type { CrmCtx } from '../shared/crm-access';
import { CRM_PDF_COLORS as C, createCrmPdf, pdfToBuffer } from './pdf-fonts';

type Row = typeof presentations.$inferSelect;

/** C10 branded presentations: curated listing selection as a public link or PDF, with open tracking. */
@Injectable()
export class PresentationsService {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly notify: NotificationsService,
    private readonly activities: ActivityService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async toRows(orgId: string, rows: Row[]): Promise<PresentationRow[]> {
    const contactIds = [...new Set(rows.map((r) => r.contactId).filter((x): x is string => !!x))];
    const contacts = contactIds.length ? await this.dbs.org(orgId, (tx) => tx.select({ id: crmContacts.id, name: crmContacts.name }).from(crmContacts).where(inArray(crmContacts.id, contactIds))) : [];
    const userIds = [...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x))];
    const authors = userIds.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
    const cName = new Map(contacts.map((c) => [c.id, c.name]));
    const uName = new Map(authors.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      token: r.token,
      contactId: r.contactId,
      contactName: r.contactId ? (cName.get(r.contactId) ?? null) : null,
      listingIds: r.listingIds,
      openedAt: r.openedAt?.toISOString() ?? null,
      openCount: r.openCount,
      createdBy: r.createdBy,
      createdByName: r.createdBy ? (uName.get(r.createdBy) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async list(ctx: CrmCtx, contactId?: string) {
    const rows = await this.dbs.org(ctx.orgId, (tx) =>
      tx
        .select()
        .from(presentations)
        .where(and(isNull(presentations.deletedAt), contactId ? eq(presentations.contactId, contactId) : undefined, ctx.ownContactsOnly ? eq(presentations.createdBy, ctx.userId) : undefined))
        .orderBy(desc(presentations.createdAt))
        .limit(300),
    );
    return this.toRows(ctx.orgId, rows);
  }

  async get(ctx: CrmCtx, id: string) {
    const row = await this.dbs.org(ctx.orgId, (tx) => tx.query.presentations.findFirst({ where: and(eq(presentations.id, id), isNull(presentations.deletedAt)) }));
    if (!row) throw problems.notFound('პრეზენტაცია');
    return (await this.toRows(ctx.orgId, [row]))[0]!;
  }

  private async validateListings(ids: string[]) {
    const found = await this.dbs.db.select({ id: listings.id }).from(listings).where(and(inArray(listings.id, ids), isNull(listings.deletedAt)));
    if (found.length !== new Set(ids).size) throw problems.badRequest('ერთ-ერთი ფართი ვერ მოიძებნა');
  }

  private async validateContact(orgId: string, contactId: string | null | undefined) {
    if (!contactId) return;
    const c = await this.dbs.org(orgId, (tx) => tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, contactId) }));
    if (!c) throw problems.notFound('კონტაქტი');
  }

  async create(ctx: CrmCtx, input: PresentationCreate) {
    const ids = [...new Set(input.listingIds)];
    await this.validateListings(ids);
    await this.validateContact(ctx.orgId, input.contactId);
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      const [p] = await tx
        .insert(presentations)
        .values({ orgId: ctx.orgId, createdBy: ctx.userId, contactId: input.contactId ?? null, title: input.title, message: input.message ?? null, listingIds: ids, token: randomBytes(16).toString('base64url') })
        .returning();
      if (p!.contactId) await this.activities.log(ctx.orgId, { entity: 'contact', entityId: p!.contactId, type: 'presentation', payload: { title: p!.title, presentationId: p!.id, count: ids.length, event: 'created' }, createdBy: ctx.userId }, tx);
      return p!;
    });
    return (await this.toRows(ctx.orgId, [row]))[0]!;
  }

  async update(ctx: CrmCtx, id: string, patch: Partial<PresentationCreate>) {
    if (patch.listingIds) await this.validateListings(patch.listingIds);
    await this.validateContact(ctx.orgId, patch.contactId);
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      const [p] = await tx
        .update(presentations)
        .set({ ...patch, listingIds: patch.listingIds ? [...new Set(patch.listingIds)] : undefined })
        .where(and(eq(presentations.id, id), isNull(presentations.deletedAt)))
        .returning();
      return p;
    });
    if (!row) throw problems.notFound('პრეზენტაცია');
    return (await this.toRows(ctx.orgId, [row]))[0]!;
  }

  async remove(ctx: CrmCtx, id: string) {
    const [row] = await this.dbs.org(ctx.orgId, (tx) => tx.update(presentations).set({ deletedAt: new Date() }).where(and(eq(presentations.id, id), isNull(presentations.deletedAt))).returning({ id: presentations.id }));
    if (!row) throw problems.notFound('პრეზენტაცია');
    return { ok: true };
  }

  /* ---------------- public (token) ---------------- */

  private async byToken(token: string) {
    if (!token || token.length < 8 || token.length > 100) throw problems.notFound('პრეზენტაცია');
    const row = await this.dbs.system((tx) => tx.query.presentations.findFirst({ where: and(eq(presentations.token, token), isNull(presentations.deletedAt)) }));
    if (!row) throw problems.notFound('პრეზენტაცია');
    return row;
  }

  private async assemble(row: Row): Promise<PublicPresentation> {
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, row.orgId) });
    const agent = row.createdBy ? await this.dbs.db.query.users.findFirst({ where: eq(users.id, row.createdBy) }) : null;
    const contact = row.contactId ? await this.dbs.system((tx) => tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, row.contactId!) })) : null;
    const out: PublicPresentationListing[] = [];
    for (const id of row.listingIds) {
      const raw = await this.read.findRaw(id);
      if (!raw) continue;
      const d = await this.read.detail(raw);
      const specs = PASSPORT_FIELDS.flatMap((f) => {
        const v = d.passport[f.key];
        if (v === null || v === undefined || v === false) return [];
        const value = typeof v === 'boolean' ? 'კი' : `${formatNumber(Number(v), f.kind === 'number' ? 1 : 0)}${f.unit ? ` ${f.unit}` : ''}`;
        return [{ key: f.key, label: f.labelKa, value }];
      });
      const [card] = await this.read.cards([raw.id]);
      if (!card) continue;
      out.push({
        ...card,
        description: d.description,
        specs,
        portalUrl: `${this.env.APP_URL}/listings/${d.slug}`,
      });
    }
    return {
      title: row.title,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      org: { name: org?.name ?? 'lokacia.ge', logoUrl: org?.logoUrl ?? null, brandColor: org?.brandColor ?? null, phone: org?.phone ?? null, email: org?.email ?? null, website: org?.website ?? null },
      agent: agent ? { name: agent.name, phone: agent.phone, avatarUrl: agent.avatarUrl } : null,
      contactName: contact?.name ?? null,
      listings: out,
    };
  }

  async publicView(token: string) {
    return this.assemble(await this.byToken(token));
  }

  /** Records an open; notifies the author and logs an activity only on the first open. */
  async open(token: string) {
    const row = await this.byToken(token);
    const [updated] = await this.dbs.system((tx) =>
      tx
        .update(presentations)
        .set({ openCount: sql`${presentations.openCount} + 1`, openedAt: sql`coalesce(${presentations.openedAt}, now())` })
        .where(eq(presentations.id, row.id))
        .returning({ openCount: presentations.openCount, openedAt: presentations.openedAt }),
    );
    const first = !row.openedAt;
    if (first) {
      const contact = row.contactId ? await this.dbs.org(row.orgId, (tx) => tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, row.contactId!) })) : null;
      if (row.createdBy) await this.notify.notify({ userId: row.createdBy, template: 'crm_presentation_opened', vars: { title: row.title, contact: contact?.name }, link: `${this.env.CRM_URL}/presentations`, channels: ['in_app', 'telegram'] });
      if (row.contactId) await this.activities.log(row.orgId, { entity: 'contact', entityId: row.contactId, type: 'presentation', payload: { title: row.title, presentationId: row.id, event: 'opened' } });
    }
    return { openCount: updated!.openCount, openedAt: updated!.openedAt?.toISOString() ?? null, first };
  }

  async pdfByToken(token: string) {
    return this.pdf(await this.assemble(await this.byToken(token)));
  }

  async pdfById(ctx: CrmCtx, id: string) {
    const row = await this.dbs.org(ctx.orgId, (tx) => tx.query.presentations.findFirst({ where: and(eq(presentations.id, id), isNull(presentations.deletedAt)) }));
    if (!row) throw problems.notFound('პრეზენტაცია');
    return this.pdf(await this.assemble(row));
  }

  /** A4 PDF: org header with brand rule, one section per space, agent contact footer. */
  async pdf(p: PublicPresentation): Promise<Buffer> {
    const doc = createCrmPdf({ title: p.title, author: p.org.name });
    // Noto Sans Georgian has no superscript-two glyph: write square metres as „კვ.მ“ in PDFs
    const k = (s: string) => s.replace(/მ²/g, 'კვ.მ').replace(/²/g, '2');
    const brand = p.org.brandColor ?? C.green;
    const W = 499;
    const header = () => {
      doc.save();
      doc.rect(48, 36, W, 3).fill(brand);
      doc.restore();
      doc.font('ka-bold').fontSize(13).fillColor(C.basalt).text(p.org.name, 48, 48, { width: W / 2 });
      doc.font('ka').fontSize(9).fillColor(C.stone).text([p.org.phone, p.org.email].filter(Boolean).join(' · ') || 'lokacia.ge', 48 + W / 2, 52, { width: W / 2, align: 'right' });
      doc.moveTo(48, 72).lineTo(48 + W, 72).lineWidth(0.5).strokeColor(C.stone).stroke();
      doc.x = 48;
      doc.y = 84;
    };
    header();
    doc.font('ka-bold').fontSize(22).fillColor(C.basalt).text(k(p.title), 48, doc.y, { width: W });
    doc.font('ka').fontSize(10).fillColor(C.stone).text(`${formatDateKa(p.createdAt)}${p.contactName ? ` · ${p.contactName}` : ''} · ${p.listings.length} ფართი`, { width: W });
    if (p.message) {
      doc.moveDown(0.6);
      doc.font('ka').fontSize(11).fillColor(C.basalt).text(k(p.message), { width: W, lineGap: 2 });
    }
    p.listings.forEach((l, i) => {
      if (i > 0 || doc.y > 560) {
        doc.addPage();
        header();
      } else doc.moveDown(1.2);
      doc.font('ka').fontSize(9).fillColor(C.stone).text(`${String(i + 1).padStart(2, '0')} · ${DEAL_TYPE_LABELS_KA[l.dealType]}`, 48, doc.y, { width: W });
      doc.font('ka-bold').fontSize(16).fillColor(C.basalt).text(k(l.title), { width: W });
      doc.font('ka').fontSize(10).fillColor(C.stone).text(`${l.address}${l.districtName ? `, ${l.districtName}` : ''}`, { width: W });
      doc.moveDown(0.5);
      const period = l.pricePeriod === 'month' ? ' / თვე' : l.pricePeriod === 'day' ? ' / დღე' : l.pricePeriod === 'hour' ? ' / სთ' : '';
      const y0 = doc.y;
      doc.rect(48, y0, W, 44).lineWidth(0.6).strokeColor(C.stone).stroke();
      doc.font('ka-bold').fontSize(16).fillColor(brand).text(`${formatMoney(l.priceMinor, l.currency)}${period}`, 60, y0 + 13, { width: 240 });
      doc.font('ka-bold').fontSize(16).fillColor(C.basalt).text(k(formatArea(l.areaM2)), 300, y0 + 13, { width: 235, align: 'right' });
      doc.y = y0 + 56;
      doc.x = 48;
      const rows: [string, string][] = [];
      if (l.floor !== null) rows.push(['სართული', String(l.floor)]);
      for (const s of l.specs) rows.push([s.label, k(s.value)]);
      if (l.commissionPct !== null && l.commissionPct !== undefined) rows.push(['კომისია', `${formatNumber(l.commissionPct, 1)}%`]);
      for (const [k, v] of rows) {
        const y = doc.y;
        doc.font('ka').fontSize(10).fillColor(C.stone).text(k, 48, y, { width: 240 });
        doc.font('ka-bold').fontSize(10).fillColor(C.basalt).text(v, 300, y, { width: 247, align: 'right' });
        doc.moveTo(48, doc.y + 2).lineTo(48 + W, doc.y + 2).lineWidth(0.3).dash(1, { space: 2 }).strokeColor(C.stone).stroke().undash();
        doc.y += 6;
      }
      if (l.description) {
        doc.moveDown(0.6);
        const excerpt = l.description.length > 900 ? `${l.description.slice(0, 900).trimEnd()}…` : l.description;
        doc.font('ka').fontSize(10).fillColor(C.basalt).text(k(excerpt), 48, doc.y, { width: W, lineGap: 2 });
      }
      doc.moveDown(0.5);
      doc.font('ka').fontSize(9).fillColor(C.blue).text(l.portalUrl, 48, doc.y, { width: W, link: l.portalUrl, underline: true });
    });
    // footer with agent contact on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      const agent = p.agent ? [p.agent.name, p.agent.phone].filter(Boolean).join(' · ') : p.org.name;
      doc.moveTo(48, 790).lineTo(48 + W, 790).lineWidth(0.5).strokeColor(C.stone).stroke();
      doc.font('ka').fontSize(8).fillColor(C.stone).text(`${agent} · lokacia.ge`, 48, 796, { width: W - 40, lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, 48 + W - 40, 796, { width: 40, align: 'right', lineBreak: false });
    }
    return pdfToBuffer(doc);
  }
}
