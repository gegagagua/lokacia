import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, crmContacts, crmDeals, desc, documents, eq, isNull, listings, organizations, sql, users, type SQL, type Tx } from '@lokacia/db';
import { DOCUMENT_TEMPLATE_LABELS_KA, formatDateKa, formatMoney, normalizePhone, type CrmDocument, type DocumentTemplateKey } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { ProblemException, problems } from '../../../common/problem';
import { ENV, type Env } from '../../../config/env';
import { ESIGN, type ESignProvider } from '../../../integrations/esign/esign';
import { SMS, type SmsProvider } from '../../../integrations/sms/sms';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import { visibleContact, visibleDeal, type CrmCtx } from '../shared/crm-access';
import { renderDocumentPdf } from './documents-pdf';
import { renderTemplate, TEMPLATE_BODIES } from './templates';

type DocRow = typeof documents.$inferSelect;
type Content = { fields?: Record<string, string | number>; text?: string; rootId?: string; signerName?: string; signerPhone?: string | null; signSentAt?: string; signClosedAt?: string; providerRef?: string };
const FINANCE_FIELDS = ['dealValue', 'commissionPct'] as const;
/** Public e-sign link lifetime (from send) and how long the signer may still view the outcome after deciding. */
export const SIGN_LINK_TTL_MS = 14 * 86_400_000;
export const SIGN_VIEW_AFTER_DECISION_MS = 3_600_000;
export const newSignRef = () => randomBytes(32).toString('base64url');

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
    private readonly notify: NotificationsService,
    @Inject(ESIGN) private readonly esign: ESignProvider,
    @Inject(SMS) private readonly sms: SmsProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Placeholder values gathered from deal → contact → listing → org → agent. */
  private async gatherFields(tx: Tx, ctx: CrmCtx, dealId: string | null | undefined, contactId: string | null | undefined) {
    const orgId = ctx.orgId;
    const agentId = ctx.userId;
    // linked records must be visible to the caller (agents: own deals/contacts), otherwise their data would leak into the document
    const deal = dealId ? await visibleDeal(tx, ctx, dealId) : null;
    const contact = contactId && contactId !== deal?.contactId ? await visibleContact(tx, ctx, contactId) : deal?.contactId ? await tx.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, deal.contactId), isNull(crmContacts.deletedAt)) }) : null;
    const finance = ctx.can('finance.view');
    const listing = deal?.listingId ? await tx.query.listings.findFirst({ where: eq(listings.id, deal.listingId) }) : null;
    const org = await tx.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    const agent = await tx.query.users.findFirst({ where: eq(users.id, deal?.agentId ?? agentId) });
    const fields: Record<string, string | number> = {
      date: formatDateKa(new Date()),
      org: org?.name ?? '',
      agent: agent?.name ?? '',
      client: contact?.name ?? '',
      clientPhone: contact?.phones[0] ?? '',
      dealTitle: deal?.title ?? '',
      dealValue: deal && finance ? formatMoney(deal.valueMinor) : '',
      commissionPct: !finance ? '' : deal ? Number(deal.commissionPct) : 10,
      listingAddress: listing?.address ?? '',
      area: listing ? Number(listing.areaM2) : '',
      price: listing ? formatMoney(listing.priceMinor) : '',
      dealKind: listing?.dealType === 'sale' ? 'გაყიდვის' : 'იჯარაში გაცემის',
      termMonths: 6,
    };
    return { fields, deal, contact, org };
  }

  private rootOf(d: DocRow) {
    return (d.content as Content | null)?.rootId ?? d.id;
  }

  private textOf(d: DocRow) {
    const c = (d.content ?? {}) as Content;
    if (c.text) return c.text;
    const tpl = d.template !== 'custom' ? TEMPLATE_BODIES[d.template] : null;
    return tpl ? renderTemplate(tpl.body, (c.fields ?? {}) as Record<string, string | number>) : '';
  }

  private visibleFields(ctx: CrmCtx, fields: Record<string, string | number>) {
    if (ctx.can('finance.view')) return fields;
    const out = { ...fields };
    for (const k of FINANCE_FIELDS) delete out[k];
    return out;
  }

  /** Agents see documents of their own deals / contacts (or ones they created); managers & assistants the whole org. */
  private scope(ctx: CrmCtx): SQL | undefined {
    if (!ctx.ownDealsOnly && !ctx.ownContactsOnly) return undefined;
    const deal = ctx.ownDealsOnly ? sql`${documents.dealId} IN (SELECT id FROM crm_deals WHERE agent_id = ${ctx.userId} AND deleted_at IS NULL)` : sql`${documents.dealId} IS NOT NULL`;
    const contact = ctx.ownContactsOnly ? sql`${documents.contactId} IN (SELECT id FROM crm_contacts WHERE owner_agent_id = ${ctx.userId} AND deleted_at IS NULL AND merged_into_id IS NULL)` : sql`${documents.contactId} IS NOT NULL`;
    return sql`((${documents.dealId} IS NOT NULL AND ${deal}) OR (${documents.dealId} IS NULL AND ${contact}) OR ${documents.createdBy} = ${ctx.userId})`;
  }

  private async toDto(tx: Tx, d: DocRow, ctx: CrmCtx): Promise<CrmDocument> {
    const rootId = this.rootOf(d);
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from documents where deleted_at is null and (id = ${rootId} or content->>'rootId' = ${rootId})`)) as unknown as [{ n: number }];
    const deal = d.dealId ? await tx.query.crmDeals.findFirst({ where: eq(crmDeals.id, d.dealId) }) : null;
    const contact = d.contactId ? await tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, d.contactId) }) : null;
    return {
      id: d.id,
      rootId,
      parentId: d.parentId,
      template: d.template,
      title: d.title,
      version: d.version,
      versionsCount: n,
      dealId: d.dealId,
      dealTitle: deal?.title ?? null,
      contactId: d.contactId,
      contactName: contact?.name ?? null,
      signStatus: d.signStatus,
      signRef: d.signRef,
      signUrl: d.signRef ? `${this.env.CRM_URL}/sign/${d.signRef}` : null,
      signedAt: d.signedAt?.toISOString() ?? null,
      fields: this.visibleFields(ctx, ((d.content as Content | null)?.fields ?? {}) as Record<string, string | number>),
      text: this.textOf(d),
      createdAt: d.createdAt.toISOString(),
    };
  }

  /** Latest version of every document chain. */
  list(ctx: CrmCtx, q: { dealId?: string; contactId?: string }) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(documents)
        .where(
          and(
            isNull(documents.deletedAt),
            q.dealId ? eq(documents.dealId, q.dealId) : undefined,
            q.contactId ? eq(documents.contactId, q.contactId) : undefined,
            sql`not exists (select 1 from documents c where c.parent_id = ${documents.id} and c.deleted_at is null)`,
            this.scope(ctx),
          ),
        )
        .orderBy(desc(documents.updatedAt))
        .limit(300);
      return Promise.all(rows.map((r) => this.toDto(tx, r, ctx)));
    });
  }

  private async load(tx: Tx, ctx: CrmCtx, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('დოკუმენტი');
    const d = await tx.query.documents.findFirst({ where: and(eq(documents.id, id), isNull(documents.deletedAt), this.scope(ctx)) });
    if (!d) throw problems.notFound('დოკუმენტი');
    return d;
  }

  async get(ctx: CrmCtx, id: string) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.load(tx, ctx, id);
      const rootId = this.rootOf(d);
      const chain = await tx
        .select()
        .from(documents)
        .where(and(isNull(documents.deletedAt), sql`(${documents.id} = ${rootId} or ${documents.content}->>'rootId' = ${rootId})`))
        .orderBy(documents.version);
      return { ...(await this.toDto(tx, d, ctx)), versions: chain.map((v) => ({ id: v.id, version: v.version, signStatus: v.signStatus, createdAt: v.createdAt.toISOString() })) };
    });
  }

  async create(ctx: CrmCtx, input: { template: Exclude<DocumentTemplateKey, 'custom'>; dealId?: string | null; contactId?: string | null; title?: string | null; fields: Record<string, string | number> }) {
    const doc = await this.dbs.org(ctx.orgId, async (tx) => {
      const { fields: base, deal, contact } = await this.gatherFields(tx, ctx, input.dealId, input.contactId);
      const fields = { ...base, ...input.fields };
      const tpl = TEMPLATE_BODIES[input.template];
      const [row] = await tx
        .insert(documents)
        .values({ orgId: ctx.orgId, dealId: deal?.id ?? null, contactId: contact?.id ?? null, template: input.template, title: input.title ?? tpl.title ?? DOCUMENT_TEMPLATE_LABELS_KA[input.template], version: 1, content: { fields, text: renderTemplate(tpl.body, fields) }, createdBy: ctx.userId })
        .returning();
      const entity = deal ? { entity: 'deal' as const, entityId: deal.id } : contact ? { entity: 'contact' as const, entityId: contact.id } : null;
      if (entity) await this.activities.log(ctx.orgId, { ...entity, type: 'document', payload: { title: `${row!.title} — ვერსია 1` }, createdBy: ctx.userId }, tx);
      return row!;
    });
    return this.get(ctx, doc.id);
  }

  async newVersion(ctx: CrmCtx, id: string, input: { title?: string; fields?: Record<string, string | number>; text?: string }) {
    const created = await this.dbs.org(ctx.orgId, async (tx) => {
      const prev = await this.load(tx, ctx, id);
      if (prev.signStatus === 'signed' || prev.signStatus === 'sent') throw problems.conflict('ხელმოწერილ ან ხელმოწერასთვის გაგზავნილ დოკუმენტს ახალი ვერსია შეუძლებელია');
      const child = await tx.query.documents.findFirst({ where: and(eq(documents.parentId, prev.id), isNull(documents.deletedAt)) });
      if (child) throw problems.conflict('ახალი ვერსია შეიძლება შეიქმნოს მხოლოდ ბოლო ვერსიიდან');
      const pc = (prev.content ?? {}) as Content;
      const fields = { ...(pc.fields ?? {}), ...(input.fields ?? {}) } as Record<string, string | number>;
      const tpl = prev.template !== 'custom' ? TEMPLATE_BODIES[prev.template] : null;
      const text = input.text ?? (input.fields && tpl ? renderTemplate(tpl.body, fields) : this.textOf(prev));
      const [row] = await tx
        .insert(documents)
        .values({ orgId: ctx.orgId, dealId: prev.dealId, contactId: prev.contactId, parentId: prev.id, template: prev.template, title: input.title ?? prev.title, version: prev.version + 1, content: { fields, text, rootId: this.rootOf(prev) }, createdBy: ctx.userId })
        .returning();
      return row!;
    });
    return this.get(ctx, created.id);
  }

  async pdf(ctx: CrmCtx, id: string) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.load(tx, ctx, id);
      const org = await tx.query.organizations.findFirst({ where: eq(organizations.id, ctx.orgId) });
      const c = (d.content ?? {}) as Content;
      const buf = await renderDocumentPdf({ title: d.title, text: this.textOf(d), org: org?.name ?? 'lokacia.ge', version: d.version, brandColor: org?.brandColor, signStatus: d.signStatus, signedAt: d.signedAt, signerName: c.signerName });
      return { buf, fileName: `document-${d.version}.pdf` };
    });
  }

  async send(ctx: CrmCtx, id: string, input: { signerName: string; signerPhone?: string | null }) {
    const d = await this.dbs.org(ctx.orgId, (tx) => this.load(tx, ctx, id));
    if (d.signStatus === 'signed') throw problems.conflict('დოკუმენტი უკვე ხელმოწერილია');
    const phone = input.signerPhone ? normalizePhone(input.signerPhone) : null;
    if (input.signerPhone && !phone) throw problems.badRequest('ტელეფონის ნომერი არასწორია');
    const r = await this.esign.send({ id: d.id, title: d.title, signerName: input.signerName, signerPhone: phone });
    // the public link token is ours and unguessable (never the provider's envelope id); a re-send rotates it
    const ref = newSignRef();
    const signUrl = `${this.env.CRM_URL}/sign/${ref}`;
    const { signClosedAt: _closed, ...content } = (d.content ?? {}) as Content;
    await this.dbs.org(ctx.orgId, (tx) =>
      tx
        .update(documents)
        .set({ signStatus: 'sent', signProvider: this.esign.name, signRef: ref, content: { ...content, signerName: input.signerName, signerPhone: phone, providerRef: r.ref, signSentAt: new Date().toISOString() } })
        .where(eq(documents.id, d.id)),
    );
    if (phone) await this.sms.send(phone, `lokacia.ge: დოკუმენტი „${d.title}“ ხელმოწერასთვის: ${signUrl}`);
    return { ...(await this.get(ctx, d.id)), signUrl };
  }

  /** Public e-sign page data (token = sign ref). */
  /**
   * Resolves a public sign link. Only links issued by the current scheme (random 32-byte ref + `signSentAt`) are accepted;
   * they expire after SIGN_LINK_TTL_MS and stop working SIGN_VIEW_AFTER_DECISION_MS after the signer decided.
   */
  private async byRef(tx: Tx, ref: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ref)) throw problems.notFound('დოკუმენტი');
    const d = await tx.query.documents.findFirst({ where: and(eq(documents.signRef, ref), isNull(documents.deletedAt)) });
    const c = (d?.content ?? {}) as Content;
    if (!d || !c.signSentAt) throw problems.notFound('დოკუმენტი');
    const now = Date.now();
    if (c.signClosedAt && now - Date.parse(c.signClosedAt) > SIGN_VIEW_AFTER_DECISION_MS) throw problems.notFound('დოკუმენტი');
    if (d.signStatus === 'sent' && now - Date.parse(c.signSentAt) > SIGN_LINK_TTL_MS) throw new ProblemException(410, 'sign-link-expired', 'ხელმოწერის ბმულს ვადა გაუვიდა', 'ბმული ძალაში არ არის — სთხოვეთ აგენტს ხელახლა გაგზავნა');
    return d;
  }

  async publicView(ref: string) {
    return this.dbs.system(async (tx) => {
      const d = await this.byRef(tx, ref);
      const org = await tx.query.organizations.findFirst({ where: eq(organizations.id, d.orgId) });
      const c = (d.content ?? {}) as Content;
      return { title: d.title, version: d.version, org: { name: org?.name ?? '', logoUrl: org?.logoUrl ?? null, brandColor: org?.brandColor ?? null }, text: this.textOf(d), signStatus: d.signStatus, signedAt: d.signedAt?.toISOString() ?? null, signerName: c.signerName ?? null };
    });
  }

  async publicSign(ref: string, input: { decision: 'sign' | 'decline'; name: string }) {
    const d = await this.dbs.system(async (tx) => {
      const doc = await this.byRef(tx, ref);
      if (doc.signStatus !== 'sent') throw problems.conflict(doc.signStatus === 'signed' ? 'დოკუმენტი უკვე ხელმოწერილია' : 'დოკუმენტი ხელმოწერასთვის არ არის გაგზავნილი');
      const signed = input.decision === 'sign';
      const [row] = await tx
        .update(documents)
        .set({ signStatus: signed ? 'signed' : 'declined', signedAt: signed ? new Date() : null, content: { ...((doc.content ?? {}) as Content), signerName: input.name, signClosedAt: new Date().toISOString() } })
        .where(and(eq(documents.id, doc.id), eq(documents.signStatus, 'sent')))
        .returning();
      if (!row) throw problems.conflict('დოკუმენტი უკვე ხელმოწერილია');
      const entity = doc.dealId ? { entity: 'deal' as const, entityId: doc.dealId } : doc.contactId ? { entity: 'contact' as const, entityId: doc.contactId } : null;
      if (entity) await this.activities.log(doc.orgId, { ...entity, type: 'document', payload: { title: `${doc.title}: ${signed ? 'ხელმოწერილია' : 'უარყოფილია'} (${input.name})` } }, tx);
      return row!;
    });
    if (d.createdBy)
      await this.notify.notify({ userId: d.createdBy, template: d.signStatus === 'signed' ? 'crm_document_signed' : 'generic', vars: d.signStatus === 'signed' ? { title: d.title } : { title: 'CRM: დოკუმენტი უარყოფილია', body: `„${d.title}“ — ${input.name}` }, link: `${this.env.CRM_URL}/documents?id=${d.id}`, channels: ['in_app'] });
    return { signStatus: d.signStatus, signedAt: d.signedAt?.toISOString() ?? null };
  }

  async remove(ctx: CrmCtx, id: string) {
    await this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.load(tx, ctx, id);
      if (d.signStatus === 'signed') throw problems.conflict('ხელმოწერილ დოკუმენტის წაშლა შეუძლებელია');
      await tx.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
    });
    return { ok: true };
  }
}
