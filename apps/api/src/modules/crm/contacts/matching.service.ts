import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, crmContacts, crmMatches, desc, eq, inArray, isNull, listings, sql } from '@lokacia/db';
import { MATCH_THRESHOLD, matchScore, type MatchStatus } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { ENV, type Env } from '../../../config/env';
import { ListingReadService } from '../../listings/listing-read.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import type { CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';
import { ContactsService, newPortalToken } from './contacts.service';

type NewMatch = { orgId: string; contactId: string; contactName: string; ownerAgentId: string | null; listingId: string; listingTitle: string; matchId: string };

/** C2: client requirements ↔ listings. Runs on `listings.published` and on requirement changes. */
@Injectable()
export class MatchingService implements OnModuleInit {
  private readonly logger = new Logger('CrmMatching');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly events: CrmEventsService,
    private readonly notify: NotificationsService,
    private readonly activities: ActivityService,
    private readonly read: ListingReadService,
    private readonly contacts: ContactsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('listings.published', (d: { listingId: string }) => this.matchListing(d.listingId));
    this.queue.register('crm.match-contact', (d: { orgId: string; contactId: string }) => this.matchContact(d.orgId, d.contactId));
    this.events.on('contact.requirements_changed', ({ orgId, contactId }) => this.matchContact(orgId, contactId));
  }

  /** New listing → every org's client contacts with requirements (system context: crosses orgs by design). */
  async matchListing(listingId: string) {
    const created = await this.dbs.system(async (tx) => {
      const l = await tx.query.listings.findFirst({ where: and(eq(listings.id, listingId), isNull(listings.deletedAt)) });
      if (!l || l.status !== 'active') return [];
      const candidates = await tx
        .select()
        .from(crmContacts)
        .where(
          and(
            isNull(crmContacts.deletedAt),
            isNull(crmContacts.mergedIntoId),
            eq(crmContacts.type, 'client'),
            sql`${crmContacts.requirements} IS NOT NULL`,
            sql`(${crmContacts.requirements}->>'businessType' IS NULL OR ${crmContacts.requirements}->>'businessType' = ANY(string_to_array(${l.businessTypes.join(',')}, ',')))`,
            sql`(${crmContacts.requirements}->>'dealType' IS NULL OR ${crmContacts.requirements}->>'dealType' = ${l.dealType})`,
          ),
        );
      const out: NewMatch[] = [];
      for (const c of candidates) {
        const score = matchScore(c.requirements ?? {}, l);
        if (score < MATCH_THRESHOLD) continue;
        const [m] = await tx.insert(crmMatches).values({ orgId: c.orgId, contactId: c.id, listingId: l.id, score, notifiedAt: new Date() }).onConflictDoNothing().returning();
        if (!m) continue;
        await this.activities.log(c.orgId, { entity: 'contact', entityId: c.id, type: 'match', payload: { body: `${l.title} — ${score}%`, listingId: l.id, score } }, tx);
        out.push({ orgId: c.orgId, contactId: c.id, contactName: c.name, ownerAgentId: c.ownerAgentId, listingId: l.id, listingTitle: l.title, matchId: m.id });
      }
      return out;
    });
    for (const m of created) {
      if (!m.ownerAgentId) continue;
      await this.notify
        .notify({ userId: m.ownerAgentId, template: 'crm_match', category: 'crm', vars: { contact: m.contactName, title: m.listingTitle }, link: `${this.env.CRM_URL}/contacts/${m.contactId}?tab=matches` })
        .catch((e: Error) => this.logger.warn(`notify failed: ${e.message}`));
    }
    return { created: created.length };
  }

  /** Requirement change → compare the contact with all active listings (SQL prefilter + score). */
  async matchContact(orgId: string, contactId: string) {
    const res = await this.dbs.org(orgId, async (tx) => {
      const c = await tx.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, contactId), isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId)) });
      const r = c?.requirements;
      if (!c || !r) return null;
      const where = [eq(listings.status, 'active'), isNull(listings.deletedAt)];
      if (r.businessType) where.push(sql`${listings.businessTypes} @> ARRAY[${r.businessType}]::text[]`);
      if (r.dealType) where.push(sql`${listings.dealType} = ${r.dealType}`);
      if (r.areaMin != null) where.push(sql`${listings.areaM2} >= ${r.areaMin * 0.9}`);
      if (r.areaMax != null) where.push(sql`${listings.areaM2} <= ${r.areaMax * 1.1}`);
      if (r.budgetMaxMinor) where.push(sql`${listings.priceMinor} <= ${Math.round(r.budgetMaxMinor * 1.1)}`);
      if (r.districtIds?.length) where.push(inArray(listings.districtId, r.districtIds));
      const rows = await tx.select().from(listings).where(and(...where)).orderBy(desc(listings.publishedAt)).limit(300);
      const created: { id: string; title: string }[] = [];
      for (const l of rows) {
        const score = matchScore(r, l);
        if (score < MATCH_THRESHOLD) continue;
        const [m] = await tx.insert(crmMatches).values({ orgId, contactId: c.id, listingId: l.id, score, notifiedAt: new Date() }).onConflictDoNothing().returning();
        if (m) created.push({ id: l.id, title: l.title });
      }
      if (created.length) {
        await this.activities.log(orgId, { entity: 'contact', entityId: c.id, type: 'match', payload: { body: `${created.length} ახალი შესაფერისი ფართი`, listingIds: created.map((x) => x.id) } }, tx);
      }
      return { contact: c, created };
    });
    if (res?.created.length && res.contact.ownerAgentId) {
      await this.notify
        .notify({
          userId: res.contact.ownerAgentId,
          template: 'crm_match',
          category: 'crm',
          vars: { contact: res.contact.name, title: res.created.length === 1 ? res.created[0]!.title : `${res.created.length} ფართი` },
          link: `${this.env.CRM_URL}/contacts/${res.contact.id}?tab=matches`,
        })
        .catch((e: Error) => this.logger.warn(`notify failed: ${e.message}`));
    }
    return { created: res?.created.length ?? 0 };
  }

  async list(ctx: CrmCtx, contactId: string) {
    const rows = await this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.contacts.getRaw(ctx, contactId, tx);
      return tx.select().from(crmMatches).where(and(eq(crmMatches.contactId, c.id), isNull(crmMatches.deletedAt))).orderBy(desc(crmMatches.score), desc(crmMatches.createdAt));
    });
    const cards = await this.read.cards(rows.map((r) => r.listingId));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows
      .filter((r) => byId.has(r.listingId))
      .map((r) => ({ id: r.id, score: r.score, status: r.status, clientComment: r.clientComment, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), listing: byId.get(r.listingId)! }));
  }

  async setStatus(ctx: CrmCtx, contactId: string, matchId: string, status: MatchStatus) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.contacts.getRaw(ctx, contactId, tx);
      const [m] = await tx.update(crmMatches).set({ status }).where(and(eq(crmMatches.id, matchId), eq(crmMatches.contactId, c.id))).returning();
      if (!m) throw problems.notFound('შესაფერისი ფართი');
      return m;
    });
  }

  /** Send a selection to the client portal (C2 → C8). */
  async sendToPortal(ctx: CrmCtx, contactId: string, matchIds: string[]) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.contacts.getRaw(ctx, contactId, tx);
      let token = c.portalToken;
      if (!token) {
        token = newPortalToken();
        await tx.update(crmContacts).set({ portalToken: token }).where(eq(crmContacts.id, c.id));
      }
      const updated = await tx
        .update(crmMatches)
        .set({ status: 'sent' })
        .where(and(eq(crmMatches.contactId, c.id), inArray(crmMatches.id, matchIds), sql`${crmMatches.status} IN ('new', 'dismissed', 'sent')`))
        .returning({ id: crmMatches.id });
      await this.activities.log(ctx.orgId, { entity: 'contact', entityId: c.id, type: 'match', payload: { body: `კლიენტის პორტალზე გაიგზავნა ${updated.length} ფართი`, matchIds: updated.map((u) => u.id) }, createdBy: ctx.userId }, tx);
      return { sent: updated.length, token, url: this.contacts.portalUrl(token) };
    });
  }
}
