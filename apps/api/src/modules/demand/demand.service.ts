import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  and, conversations, demandRequests, desc, eq, isNull, listings, messages, sql, tenantProfiles, users, type SQL,
} from '@lokacia/db';
import {
  decodeCursor, demandToFilters, encodeCursor, formatMoney, type DemandDto, type DemandListQuery, type SearchQuery,
} from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems, ProblemException } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import { RateLimitService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import type { AuthUser } from '../../common/request';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

type Row = typeof demandRequests.$inferSelect;
type CreateInput = {
  businessType: string;
  dealType: 'rent' | 'sale' | 'transfer' | 'short_term';
  title: string;
  description?: string | null;
  areaMin?: number | null;
  areaMax?: number | null;
  budgetMinor?: number | null;
  districtIds: string[];
  contactPhone?: string | null;
  expiresInDays?: number;
};

/** P6 demand board: businesses post what they need; owners & brokers respond. */
@Injectable()
export class DemandService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly tax: TaxonomyService,
    private readonly search: SearchService,
    private readonly settings: SettingsService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
    private readonly rate: RateLimitService,
  ) {}

  onModuleInit() {
    this.queue.register('demand.expire', () => this.expire());
    this.queue.every('demand.expire', 3600_000);
    this.queue.register('listings.published', (d: { listingId: string }) => this.onListingPublished(d.listingId));
  }

  private async toDtos(rows: Row[], user?: AuthUser): Promise<DemandDto[]> {
    if (!rows.length) return [];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const people = await this.dbs.db
      .select({ id: users.id, name: users.name, companyName: tenantProfiles.companyName, activity: tenantProfiles.activity })
      .from(users)
      .leftJoin(tenantProfiles, eq(tenantProfiles.userId, users.id))
      .where(sql`${users.id} = ANY(${`{${userIds.join(',')}}`}::uuid[])`);
    const byUser = new Map(people.map((p) => [p.id, p]));
    const contacts = await this.dbs.db.execute<{ demand_id: string; n: string }>(sql`
      SELECT (payload->>'demandId') AS demand_id, count(*) AS n FROM notifications
      WHERE template = 'demand_contact' AND channel = 'in_app' AND payload->>'demandId' = ANY(${`{${rows.map((r) => r.id).join(',')}}`}::text[])
      GROUP BY 1`);
    const contactsBy = new Map(contacts.map((c) => [c.demand_id, Number(c.n)]));
    const out: DemandDto[] = [];
    for (const r of rows) {
      const bt = await this.tax.businessType(r.businessType);
      const districts = (await Promise.all(r.districtIds.map((id) => this.tax.districtById(id)))).filter((d) => !!d);
      const p = byUser.get(r.userId);
      // public: first name + initial only (personal data)
      const [first, last] = (p?.name ?? 'მომხმარებელი').split(' ');
      const status = r.status === 'active' && r.expiresAt < new Date() ? 'expired' : r.status;
      out.push({
        id: r.id,
        title: r.title,
        description: r.description,
        businessType: r.businessType,
        businessTypeName: bt?.nameKa ?? r.businessType,
        dealType: r.dealType,
        areaMin: r.areaMin,
        areaMax: r.areaMax,
        budgetMinor: r.budgetMinor,
        districts: districts.map((d) => ({ id: d.id, slug: d.slug, name: d.nameKa })),
        status,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        requester: { name: last ? `${first} ${last[0]}.` : first!, companyName: p?.companyName ?? null, activity: p?.activity ?? null },
        mine: !!user && user.id === r.userId,
        contactsCount: contactsBy.get(r.id) ?? 0,
      });
    }
    return out;
  }

  async list(q: DemandListQuery, user?: AuthUser) {
    const offset = decodeCursor<{ o: number }>(q.cursor)?.o ?? 0;
    const where: SQL[] = [sql`deleted_at IS NULL`, sql`status = 'active'`, sql`expires_at > now()`];
    if (q.businessType) where.push(sql`business_type = ${q.businessType}`);
    if (q.dealType) where.push(sql`deal_type = ${q.dealType}`);
    if (q.districtId) where.push(sql`(${q.districtId}::uuid = ANY(district_ids) OR cardinality(district_ids) = 0)`);
    if (q.areaMin != null) where.push(sql`(area_max IS NULL OR area_max >= ${q.areaMin})`);
    if (q.budgetMax != null) where.push(sql`(budget_minor IS NULL OR budget_minor <= ${Math.round(q.budgetMax * 100)})`);
    if (q.q) where.push(sql`(title ILIKE ${`%${q.q.replace(/[%_]/g, '')}%`} OR description ILIKE ${`%${q.q.replace(/[%_]/g, '')}%`})`);
    const rows = await this.dbs.db.execute<{ id: string; total: string }>(sql`
      SELECT id, count(*) OVER() AS total FROM demand_requests WHERE ${sql.join(where, sql` AND `)}
      ORDER BY created_at DESC, id LIMIT ${q.limit} OFFSET ${offset}`);
    const total = rows[0] ? Number(rows[0].total) : 0;
    const full = rows.length ? await this.dbs.db.select().from(demandRequests).where(sql`${demandRequests.id} = ANY(${`{${rows.map((r) => r.id).join(',')}}`}::uuid[])`) : [];
    const byId = new Map(full.map((r) => [r.id, r]));
    const items = await this.toDtos(rows.map((r) => byId.get(r.id)!).filter(Boolean), user);
    return { items, total, nextCursor: offset + rows.length < total ? encodeCursor({ o: offset + rows.length }) : null };
  }

  async mine(user: AuthUser) {
    const rows = await this.dbs.db.query.demandRequests.findMany({ where: and(eq(demandRequests.userId, user.id), isNull(demandRequests.deletedAt)), orderBy: desc(demandRequests.createdAt) });
    return this.toDtos(rows, user);
  }

  private async get(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('მოთხოვნა');
    const r = await this.dbs.db.query.demandRequests.findFirst({ where: and(eq(demandRequests.id, id), isNull(demandRequests.deletedAt)) });
    if (!r) throw problems.notFound('მოთხოვნა');
    return r;
  }

  async detail(id: string, user?: AuthUser) {
    const r = await this.get(id);
    const isMine = !!user && user.id === r.userId;
    if (r.status !== 'active' && !isMine && user?.role !== 'admin' && user?.role !== 'moderator') throw problems.notFound('მოთხოვნა');
    const [dto] = await this.toDtos([r], user);
    return { ...dto!, contactPhone: isMine ? r.contactPhone : null };
  }

  async create(user: AuthUser, input: CreateInput) {
    const bt = await this.tax.businessType(input.businessType);
    if (!bt) throw new ProblemException(422, 'validation', 'შეყვანილი მონაცემები არასწორია', undefined, { errors: [{ path: 'businessType', message: 'ბიზნესის ტიპი ვერ მოიძებნა' }] });
    const active = await this.dbs.db.$count(demandRequests, and(eq(demandRequests.userId, user.id), eq(demandRequests.status, 'active'), isNull(demandRequests.deletedAt)));
    if (active >= 10) throw problems.conflict('აქტიური მოთხოვნების ლიმიტი — 10');
    const days = input.expiresInDays ?? ((await this.settings.number('demand_expiry_days')) || 30);
    const districtIds = [];
    for (const id of input.districtIds) if (await this.tax.districtById(id)) districtIds.push(id);
    const [row] = await this.dbs.db
      .insert(demandRequests)
      .values({
        userId: user.id,
        businessType: input.businessType,
        dealType: input.dealType,
        title: input.title,
        description: input.description ?? null,
        areaMin: input.areaMin ?? null,
        areaMax: input.areaMax ?? null,
        budgetMinor: input.budgetMinor ?? null,
        districtIds,
        contactPhone: input.contactPhone ?? null,
        expiresAt: new Date(Date.now() + days * 86_400_000),
      })
      .returning();
    const [dto] = await this.toDtos([row!], user);
    return dto!;
  }

  async close(user: AuthUser, id: string) {
    const r = await this.get(id);
    if (r.userId !== user.id && user.role !== 'admin' && user.role !== 'moderator') throw problems.forbidden();
    await this.dbs.db.update(demandRequests).set({ status: 'closed' }).where(eq(demandRequests.id, id));
    return { ok: true, status: 'closed' as const };
  }

  async renew(user: AuthUser, id: string) {
    const r = await this.get(id);
    if (r.userId !== user.id) throw problems.forbidden();
    const days = (await this.settings.number('demand_expiry_days')) || 30;
    await this.dbs.db.update(demandRequests).set({ status: 'active', expiresAt: new Date(Date.now() + days * 86_400_000) }).where(eq(demandRequests.id, id));
    return this.detail(id, user);
  }

  private async filtersFor(r: Row): Promise<SearchQuery> {
    const slugs = (await Promise.all(r.districtIds.map((id) => this.tax.districtById(id)))).filter((d) => !!d).map((d) => d.slug);
    return { ...demandToFilters({ ...r, districtSlugs: slugs }), limit: 12 } as SearchQuery;
  }

  /** Suggested listings for a request (AC: matching listings suggested to the requester). */
  async matches(id: string, limit = 12) {
    const r = await this.get(id);
    const q = await this.filtersFor(r);
    const res = await this.search.search({ ...q, limit });
    const { limit: _l, ...filters } = q;
    return { items: res.items, total: res.total, filters };
  }

  /** Owner/broker responds: in-app + SMS notification to the requester and a portal conversation. */
  async contact(user: AuthUser, id: string, body: string, listingId?: string | null) {
    const r = await this.get(id);
    if (r.status !== 'active' || r.expiresAt < new Date()) throw problems.conflict('მოთხოვნა ვადაგასულია ან დახურულია');
    if (r.userId === user.id) throw problems.badRequest('საკუთარ მოთხოვნაზე გამოხმაურება შეუძლებელია');
    await this.rate.hit(`demand-contact:${user.id}`, 30, 3600);
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    const found = listingId ? await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, listingId), isNull(listings.deletedAt)) }) : null;
    // only a public listing can be attached (never leak the title/slug of someone else's draft)
    const listing = found && ['active', 'stale'].includes(found.status) ? found : null;
    const text = listing ? `${body}\n\nფართი: ${listing.title} — /listings/${listing.slug}` : body;
    const conversationId = await this.dbs.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(isNull(conversations.orgId), sql`${conversations.participantIds} @> ARRAY[${user.id}, ${r.userId}]::uuid[]`, eq(conversations.subject, `მოთხოვნა: ${r.title}`)))
        .limit(1);
      let convId = existing[0]?.id;
      if (!convId) {
        const [c] = await tx
          .insert(conversations)
          .values({ listingId: listing?.id ?? null, participantIds: [user.id, r.userId], channel: 'portal', subject: `მოთხოვნა: ${r.title}`, lastMessageAt: new Date() })
          .returning({ id: conversations.id });
        convId = c!.id;
      } else await tx.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, convId));
      await tx.insert(messages).values({ conversationId: convId, senderId: user.id, body: text, direction: 'out' });
      return convId;
    });
    await this.notify.notify({
      userId: r.userId,
      template: 'demand_contact',
      category: 'messages',
      channels: ['in_app', 'sms'],
      vars: { from: me?.name ?? 'მომხმარებელი', body: body.slice(0, 140), demandId: r.id, title: r.title },
      link: `/account/messages?conversation=${conversationId}`,
    });
    return { ok: true, conversationId };
  }

  async expire() {
    const rows = await this.dbs.db.execute<{ id: string }>(sql`UPDATE demand_requests SET status = 'expired', updated_at = now() WHERE status = 'active' AND expires_at <= now() AND deleted_at IS NULL RETURNING id`);
    return { expired: rows.length };
  }

  /** New listing → tell requesters whose active demand it matches. */
  async onListingPublished(listingId: string) {
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    if (!l || l.status !== 'active') return { notified: 0 };
    const rows = await this.dbs.db
      .select()
      .from(demandRequests)
      .where(
        and(
          eq(demandRequests.status, 'active'),
          isNull(demandRequests.deletedAt),
          sql`${demandRequests.expiresAt} > now()`,
          sql`${demandRequests.businessType} = ANY(${`{${l.businessTypes.join(',')}}`}::text[])`,
          eq(demandRequests.dealType, l.dealType),
          sql`${demandRequests.userId} <> ${l.ownerId}`,
        ),
      );
    let notified = 0;
    for (const r of rows) {
      if (!(await this.search.engine.matches(l.id, await this.filtersFor(r)))) continue;
      await this.notify.notify({ userId: r.userId, template: 'demand_match', category: 'listing', channels: ['in_app'], vars: { title: l.title, price: formatMoney(l.priceMinor, l.currency), demandId: r.id }, link: `/listings/${l.slug}` });
      notified++;
    }
    return { notified };
  }
}
