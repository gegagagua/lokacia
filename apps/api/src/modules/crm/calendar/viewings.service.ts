import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, crmContacts, crmDeals, crmViewings, eq, gte, inArray, isNull, listings, lte, memberships, ne, organizations, users, type SQL, type Tx } from '@lokacia/db';
import type { CrmRoute, CrmRouteStop, CrmViewing, CrmViewingCreate } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { SettingsService } from '../../../common/settings.service';
import { TokensService } from '../../../common/tokens.service';
import { ENV, type Env } from '../../../config/env';
import { CALENDAR, type CalendarSync } from '../../../integrations/calendar/ics';
import { ActivityService } from '../shared/activity.service';
import { usableListing, visibleContact, visibleDeal, type CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';
import { buildIcsFeed } from './ics-feed';
import { haversineKm, optimizeRoute, pathKm, TBILISI_CENTER } from './route';

type Row = typeof crmViewings.$inferSelect;
const MIN = 60_000;

@Injectable()
export class ViewingsService {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
    private readonly events: CrmEventsService,
    private readonly tokens: TokensService,
    private readonly settings: SettingsService,
    @Inject(CALENDAR) private readonly calendar: CalendarSync,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Joins names of contacts (RLS, same tx), deals, listings and agents. */
  async hydrate(tx: Tx, rows: Row[]): Promise<CrmViewing[]> {
    const ids = <K extends keyof Row>(k: K) => [...new Set(rows.map((r) => r[k]).filter((x): x is NonNullable<Row[K]> => !!x))] as string[];
    const cIds = ids('contactId');
    const dIds = ids('dealId');
    const lIds = ids('listingId');
    const aIds = ids('agentId');
    const contacts = cIds.length ? await tx.select({ id: crmContacts.id, name: crmContacts.name, phones: crmContacts.phones }).from(crmContacts).where(inArray(crmContacts.id, cIds)) : [];
    const deals = dIds.length ? await tx.select({ id: crmDeals.id, title: crmDeals.title }).from(crmDeals).where(inArray(crmDeals.id, dIds)) : [];
    const ls = lIds.length ? await tx.select({ id: listings.id, title: listings.title }).from(listings).where(inArray(listings.id, lIds)) : [];
    const agents = aIds.length ? await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, aIds)) : [];
    const c = new Map(contacts.map((x) => [x.id, x]));
    const d = new Map(deals.map((x) => [x.id, x.title]));
    const l = new Map(ls.map((x) => [x.id, x.title]));
    const a = new Map(agents.map((x) => [x.id, x.name]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      address: r.address,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      status: r.status,
      routeOrder: r.routeOrder,
      googleEventId: r.googleEventId,
      lat: r.lat,
      lng: r.lng,
      agentId: r.agentId,
      agentName: r.agentId ? (a.get(r.agentId) ?? null) : null,
      contactId: r.contactId,
      contactName: r.contactId ? (c.get(r.contactId)?.name ?? null) : null,
      contactPhone: r.contactId ? (c.get(r.contactId)?.phones[0] ?? null) : null,
      dealId: r.dealId,
      dealTitle: r.dealId ? (d.get(r.dealId) ?? null) : null,
      listingId: r.listingId,
      listingTitle: r.listingId ? (l.get(r.listingId) ?? null) : null,
    }));
  }

  private scope(ctx: CrmCtx, agentId?: string): SQL[] {
    const where: SQL[] = [isNull(crmViewings.deletedAt)];
    if (ctx.ownDealsOnly) where.push(eq(crmViewings.agentId, ctx.userId));
    else if (agentId) where.push(eq(crmViewings.agentId, agentId));
    return where;
  }

  async list(ctx: CrmCtx, q: { from?: string; to?: string; agentId?: string; status?: Row['status'] }) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const where = this.scope(ctx, q.agentId);
      if (q.from) where.push(gte(crmViewings.startsAt, new Date(q.from)));
      if (q.to) where.push(lte(crmViewings.startsAt, new Date(q.to)));
      if (q.status) where.push(eq(crmViewings.status, q.status));
      const rows = await tx.select().from(crmViewings).where(and(...where)).orderBy(asc(crmViewings.startsAt)).limit(1000);
      return this.hydrate(tx, rows);
    });
  }

  async get(ctx: CrmCtx, id: string) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const row = await this.find(tx, ctx, id);
      return (await this.hydrate(tx, [row]))[0]!;
    });
  }

  private async find(tx: Tx, ctx: CrmCtx, id: string) {
    const [row] = await tx.select().from(crmViewings).where(and(eq(crmViewings.id, id), ...this.scope(ctx)));
    if (!row) throw problems.notFound('ჩვენება');
    return row;
  }

  async create(ctx: CrmCtx, input: CrmViewingCreate) {
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      let contactId = input.contactId ?? null;
      let listingId = input.listingId ?? null;
      let agentId = input.agentId ?? ctx.userId;
      if (ctx.ownDealsOnly) agentId = ctx.userId;
      // linked records must be visible to the caller (agents: own deals/contacts; listings: own org or publicly active)
      const deal = input.dealId ? await visibleDeal(tx, ctx, input.dealId) : null;
      if (contactId && contactId !== deal?.contactId) await visibleContact(tx, ctx, contactId);
      contactId ??= deal?.contactId ?? null;
      const listing = listingId && listingId !== deal?.listingId ? await usableListing(tx, ctx, listingId) : (listingId ?? deal?.listingId) ? await tx.query.listings.findFirst({ where: eq(listings.id, (listingId ?? deal?.listingId)!) }) : null;
      listingId ??= deal?.listingId ?? null;
      const start = new Date(input.startsAt);
      const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + (input.durationMin ?? 45) * MIN);
      if (end <= start) throw problems.badRequest('ჩვენების დასრულება დაწყებამდე არ შეიძლება');
      const [v] = await tx
        .insert(crmViewings)
        .values({
          orgId: ctx.orgId,
          contactId,
          dealId: input.dealId ?? null,
          listingId,
          agentId,
          title: input.title?.trim() || (listing ? `ჩვენება: ${listing.title.split(',')[0]}` : 'ჩვენება'),
          address: input.address ?? listing?.address ?? null,
          startsAt: start,
          endsAt: end,
          lat: input.lat ?? listing?.lat ?? null,
          lng: input.lng ?? listing?.lng ?? null,
        })
        .returning();
      const payload = { viewingId: v!.id, title: v!.title, startsAt: v!.startsAt.toISOString(), address: v!.address };
      if (contactId) await this.activities.log(ctx.orgId, { entity: 'contact', entityId: contactId, type: 'viewing', payload: { ...payload, body: `${v!.title} — ${v!.address ?? ''}` }, createdBy: ctx.userId }, tx);
      if (input.dealId) await this.activities.log(ctx.orgId, { entity: 'deal', entityId: input.dealId, type: 'viewing', payload: { ...payload, body: `${v!.title} — ${v!.address ?? ''}` }, createdBy: ctx.userId }, tx);
      return v!;
    });
    const synced = await this.syncRow(ctx.orgId, row);
    await this.events.emit('viewing.created', { orgId: ctx.orgId, viewingId: row.id, contactId: row.contactId, dealId: row.dealId });
    return this.get(ctx, synced.id);
  }

  async update(ctx: CrmCtx, id: string, patch: { title?: string; startsAt?: string; endsAt?: string; status?: Row['status']; agentId?: string | null; address?: string | null }) {
    const { before, after } = await this.dbs.org(ctx.orgId, async (tx) => {
      const before = await this.find(tx, ctx, id);
      const set: Partial<typeof crmViewings.$inferInsert> = {};
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.address !== undefined) set.address = patch.address;
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.agentId !== undefined && !ctx.ownDealsOnly) set.agentId = patch.agentId;
      if (patch.startsAt) {
        const start = new Date(patch.startsAt);
        set.startsAt = start;
        set.endsAt = patch.endsAt ? new Date(patch.endsAt) : new Date(start.getTime() + (before.endsAt.getTime() - before.startsAt.getTime()));
      } else if (patch.endsAt) set.endsAt = new Date(patch.endsAt);
      if (set.endsAt && (set.startsAt ?? before.startsAt) >= set.endsAt) throw problems.badRequest('ჩვენების დასრულება დაწყებამდე არ შეიძლება');
      const [after] = await tx.update(crmViewings).set(set).where(eq(crmViewings.id, id)).returning();
      return { before, after: after! };
    });
    if (patch.startsAt || patch.endsAt || patch.title) await this.syncRow(ctx.orgId, after);
    if (before.status !== 'done' && after.status === 'done') {
      if (after.contactId) await this.activities.log(ctx.orgId, { entity: 'contact', entityId: after.contactId, type: 'viewing', payload: { viewingId: id, status: 'done', body: `ჩვენება შედგა: ${after.title}` }, createdBy: ctx.userId });
      await this.events.emit('viewing.done', { orgId: ctx.orgId, viewingId: id, contactId: after.contactId, dealId: after.dealId });
    }
    return this.get(ctx, id);
  }

  async cancel(ctx: CrmCtx, id: string) {
    await this.dbs.org(ctx.orgId, async (tx) => {
      await this.find(tx, ctx, id);
      await tx.update(crmViewings).set({ status: 'cancelled' }).where(eq(crmViewings.id, id));
    });
    return { ok: true };
  }

  /** Google Calendar sync through the CalendarSync adapter (mock in dev). */
  private async syncRow(orgId: string, row: Row) {
    if (!row.agentId) return row;
    try {
      const { externalId } = await this.calendar.upsertEvent(row.agentId, { id: row.id, start: row.startsAt, end: row.endsAt, title: row.title, location: row.address ?? undefined });
      const [updated] = await this.dbs.org(orgId, (tx) => tx.update(crmViewings).set({ googleEventId: externalId }).where(eq(crmViewings.id, row.id)).returning());
      return updated ?? row;
    } catch {
      return row;
    }
  }

  async sync(ctx: CrmCtx, id: string) {
    const row = await this.dbs.org(ctx.orgId, (tx) => this.find(tx, ctx, id));
    await this.syncRow(ctx.orgId, row);
    return this.get(ctx, id);
  }

  /* ---------- day route (C4) ---------- */

  private dayBounds(date: string) {
    // Tbilisi is UTC+4 all year
    const from = new Date(`${date}T00:00:00+04:00`);
    return { from, to: new Date(from.getTime() + 24 * 60 * MIN) };
  }

  async route(ctx: CrmCtx, q: { date: string; agentId?: string; startLat?: number; startLng?: number }): Promise<CrmRoute> {
    const { from, to } = this.dayBounds(q.date);
    const agentId = ctx.ownDealsOnly ? ctx.userId : (q.agentId ?? ctx.userId);
    const all = await this.list(ctx, { from: from.toISOString(), to: to.toISOString(), agentId, status: 'planned' });
    const day = all.filter((v) => new Date(v.startsAt) < to);
    const located = day.filter((v): v is CrmViewing & { lat: number; lng: number } => v.lat != null && v.lng != null);
    const unlocated = day.filter((v) => v.lat == null || v.lng == null);
    const start = q.startLat != null && q.startLng != null ? { lat: q.startLat, lng: q.startLng } : located[0] ? { lat: located[0].lat, lng: located[0].lng } : TBILISI_CENTER;
    const originalKm = pathKm(start, located);
    const { order, km } = optimizeRoute(start, located);
    let clock = located[0] ? new Date(located[0].startsAt) : new Date(`${q.date}T10:00:00+04:00`);
    let prev = start;
    const stops: CrmRouteStop[] = order.map((v, i) => {
      const legKm = haversineKm(prev, v);
      prev = v;
      if (i > 0) clock = new Date(clock.getTime() + Math.ceil(((legKm / 25) * 60) / 5) * 5 * MIN); // ~25 km/h city driving, 5-min rounding
      const suggestedStart = clock.toISOString();
      clock = new Date(clock.getTime() + (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()));
      return { ...v, order: i + 1, legKm: Math.round(legKm * 100) / 100, suggestedStart };
    });
    return { date: q.date, start, stops, totalKm: Math.round(km * 100) / 100, originalKm: Math.round(originalKm * 100) / 100, unlocated };
  }

  async applyRoute(ctx: CrmCtx, input: { order: string[]; shiftTimes: boolean; dayStart: string }, date?: string) {
    await this.dbs.org(ctx.orgId, async (tx) => {
      const rows = await tx.select().from(crmViewings).where(and(inArray(crmViewings.id, input.order), ...this.scope(ctx)));
      if (rows.length !== input.order.length) throw problems.notFound('ჩვენება');
      const byId = new Map(rows.map((r) => [r.id, r]));
      const first = rows.reduce((a, b) => (a.startsAt < b.startsAt ? a : b));
      const day = date ?? new Date(first.startsAt.getTime() + 4 * 60 * MIN).toISOString().slice(0, 10);
      let clock = new Date(`${day}T${input.dayStart}:00+04:00`);
      let prev: Row | null = null;
      for (const [i, id] of input.order.entries()) {
        const r = byId.get(id)!;
        const set: Partial<typeof crmViewings.$inferInsert> = { routeOrder: i + 1 };
        if (input.shiftTimes) {
          if (prev && prev.lat != null && prev.lng != null && r.lat != null && r.lng != null) clock = new Date(clock.getTime() + Math.ceil(((haversineKm(prev as { lat: number; lng: number }, r as { lat: number; lng: number }) / 25) * 60) / 5) * 5 * MIN);
          const dur = r.endsAt.getTime() - r.startsAt.getTime();
          set.startsAt = clock;
          set.endsAt = new Date(clock.getTime() + dur);
          clock = set.endsAt;
        }
        await tx.update(crmViewings).set(set).where(eq(crmViewings.id, id));
        prev = r;
      }
    });
    return { ok: true };
  }

  /* ---------- ICS feed & Google connect ---------- */

  /** Domain-separated key: the ICS signature is never the same HMAC as anything else keyed with the refresh secret. */
  private icsKey() {
    return createHash('sha256').update(`ics:${this.env.JWT_REFRESH_SECRET}`).digest('hex');
  }

  feedToken(userId: string, orgId: string) {
    return `${userId}.${orgId}.${this.tokens.hmac(`ics:${userId}:${orgId}`, this.icsKey()).slice(0, 32)}`;
  }

  feedUrl(ctx: CrmCtx) {
    return { url: `${this.env.API_URL}/v1/crm/calendar/${this.feedToken(ctx.userId, ctx.orgId)}.ics`, webcal: `${this.env.API_URL.replace(/^https?/, 'webcal')}/v1/crm/calendar/${this.feedToken(ctx.userId, ctx.orgId)}.ics` };
  }

  async feed(token: string) {
    const [userId, orgId, sig] = token.split('.');
    if (!userId || !orgId || !sig || !/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(orgId)) throw problems.notFound('კალენდარი');
    if (!this.tokens.safeEqual(this.feedToken(userId, orgId), token)) throw problems.notFound('კალენდარი');
    // a removed/deactivated member's subscription stops working immediately
    const member = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, orgId), eq(memberships.userId, userId), eq(memberships.active, true), isNull(memberships.deletedAt)) });
    const org = member ? await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)) }) : null;
    if (!member || !org) throw problems.notFound('კალენდარი');
    const since = new Date(Date.now() - 30 * 24 * 60 * MIN);
    const rows = await this.dbs.org(orgId, (tx) =>
      tx.select().from(crmViewings).where(and(eq(crmViewings.agentId, userId), isNull(crmViewings.deletedAt), gte(crmViewings.startsAt, since), ne(crmViewings.status, 'cancelled'))).orderBy(asc(crmViewings.startsAt)).limit(500),
    );
    return buildIcsFeed(`lokacia CRM — ${org.name}`, rows.map((r) => ({ uid: r.id, start: r.startsAt, end: r.endsAt, title: r.title, location: r.address ?? undefined, url: `${this.env.CRM_URL}/calendar?viewing=${r.id}` })));
  }

  async googleStatus(ctx: CrmCtx) {
    const v = await this.settings.get<{ connectedAt?: string; provider: string } | undefined>(`crm_gcal:${ctx.userId}`);
    return { connected: !!v?.connectedAt, connectedAt: v?.connectedAt ?? null, provider: this.calendar.name };
  }

  /** Mock OAuth: marks the calendar connected and pushes all upcoming planned viewings through the adapter. */
  async googleConnect(ctx: CrmCtx) {
    await this.settings.set(`crm_gcal:${ctx.userId}`, { connectedAt: new Date().toISOString(), provider: this.calendar.name });
    const rows = await this.dbs.org(ctx.orgId, (tx) =>
      tx.select().from(crmViewings).where(and(eq(crmViewings.agentId, ctx.userId), isNull(crmViewings.deletedAt), eq(crmViewings.status, 'planned'), gte(crmViewings.startsAt, new Date()))),
    );
    for (const r of rows) await this.syncRow(ctx.orgId, r);
    return { ...(await this.googleStatus(ctx)), synced: rows.length };
  }

  async googleDisconnect(ctx: CrmCtx) {
    await this.settings.set(`crm_gcal:${ctx.userId}`, { provider: this.calendar.name, disconnectedAt: new Date().toISOString() });
    return { connected: false };
  }
}

