import { Injectable } from '@nestjs/common';
import { and, auditLog, desc, eq, isNull, listings, reviews, serviceOrders, serviceProviders, sql, users, type SQL } from '@lokacia/db';
import {
  SERVICE_CATEGORIES, SERVICE_ORDER_TRANSITIONS, decodeCursor, encodeCursor, formatMoney, type ProviderDetailDto, type ProviderDto, type ReviewDto,
  type ServiceOrderDto, type ServiceOrderStatus,
} from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems, ProblemException } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import type { AuthUser } from '../../common/request';
import { NotificationsService } from '../notifications/notifications.service';
import { registerTemplates } from '../notifications/templates';

type ProviderRow = typeof serviceProviders.$inferSelect;
type OrderRow = typeof serviceOrders.$inferSelect;

registerTemplates({
  service_accepted: { title: () => 'ფასის შეთავაზება მიღებულია', body: (v) => `${v.requester}: ${v.price}` },
  service_status: { title: () => 'შეკვეთის სტატუსი შეიცვალა', body: (v) => `${v.provider}: ${v.status}` },
});

const STATUS_KA: Record<ServiceOrderStatus, string> = {
  requested: 'ახალი მოთხოვნა', quoted: 'ფასი შეთავაზებულია', accepted: 'მიღებული', in_progress: 'სრულდება', completed: 'დასრულებული', cancelled: 'გაუქმებული',
};

/** P24 services marketplace: providers, request-a-quote, order status, commission ledger, reviews. */
@Injectable()
export class ServicesService {
  constructor(
    private readonly dbs: DbService,
    private readonly settings: SettingsService,
    private readonly notify: NotificationsService,
    private readonly rate: RateLimitService,
  ) {}

  private async completedCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.dbs.db.execute<{ provider_id: string; n: string }>(sql`
      SELECT provider_id, count(*) AS n FROM service_orders WHERE status = 'completed' AND deleted_at IS NULL AND provider_id = ANY(${`{${ids.join(',')}}`}::uuid[]) GROUP BY provider_id`);
    return new Map(rows.map((r) => [r.provider_id, Number(r.n)]));
  }

  private providerDto(p: ProviderRow, completed = 0): ProviderDto {
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      categories: p.categories,
      about: p.about,
      logoUrl: p.logoUrl,
      city: p.city,
      priceFrom: p.priceFrom,
      rating: Math.round(p.rating) / 10,
      reviewsCount: p.reviewsCount,
      verified: p.verified,
      portfolio: p.portfolio ?? [],
      completedOrders: completed,
    };
  }

  async categories() {
    const rows = await this.dbs.db.execute<{ category: string; n: string }>(sql`
      SELECT unnest(categories) AS category, count(*) AS n FROM service_providers WHERE deleted_at IS NULL GROUP BY 1`);
    const counts = new Map(rows.map((r) => [r.category, Number(r.n)]));
    return SERVICE_CATEGORIES.map((c) => ({ ...c, count: counts.get(c.slug) ?? 0 }));
  }

  async providers(q: { category?: string; city?: string; q?: string; verified?: boolean; cursor?: string; limit: number }) {
    const offset = decodeCursor<{ o: number }>(q.cursor)?.o ?? 0;
    const where: SQL[] = [sql`deleted_at IS NULL`];
    if (q.category) where.push(sql`categories @> ARRAY[${q.category}]::text[]`);
    if (q.city) where.push(sql`city = ${q.city}`);
    if (q.verified) where.push(sql`verified = true`);
    if (q.q) where.push(sql`(name ILIKE ${`%${q.q.replace(/[%_]/g, '')}%`} OR about ILIKE ${`%${q.q.replace(/[%_]/g, '')}%`})`);
    const rows = await this.dbs.db.execute<{ id: string; total: string }>(sql`
      SELECT id, count(*) OVER() AS total FROM service_providers WHERE ${sql.join(where, sql` AND `)}
      ORDER BY verified DESC, rating_x10 DESC, reviews_count DESC, id LIMIT ${q.limit} OFFSET ${offset}`);
    const total = rows[0] ? Number(rows[0].total) : 0;
    const ids = rows.map((r) => r.id);
    const full = ids.length ? await this.dbs.db.select().from(serviceProviders).where(sql`${serviceProviders.id} = ANY(${`{${ids.join(',')}}`}::uuid[])`) : [];
    const byId = new Map(full.map((p) => [p.id, p]));
    const completed = await this.completedCounts(ids);
    return {
      items: ids.map((id) => byId.get(id)!).filter(Boolean).map((p) => this.providerDto(p, completed.get(p.id) ?? 0)),
      total,
      nextCursor: offset + rows.length < total ? encodeCursor({ o: offset + rows.length }) : null,
    };
  }

  private async providerBySlug(slug: string) {
    const p = await this.dbs.db.query.serviceProviders.findFirst({ where: and(eq(serviceProviders.slug, slug), isNull(serviceProviders.deletedAt)) });
    if (!p) throw problems.notFound('მომსახურების მიმწოდებელი');
    return p;
  }

  async reviewsOf(targetType: 'broker' | 'provider' | 'org', targetId: string, limit = 20): Promise<ReviewDto[]> {
    const rows = await this.dbs.db.query.reviews.findMany({ where: and(eq(reviews.targetType, targetType), eq(reviews.targetId, targetId), isNull(reviews.deletedAt)), orderBy: desc(reviews.createdAt), limit });
    return rows.map((r) => ({ id: r.id, authorName: r.authorName, rating: r.rating, body: r.body, createdAt: r.createdAt.toISOString() }));
  }

  async provider(slug: string, user?: AuthUser): Promise<ProviderDetailDto> {
    const p = await this.providerBySlug(slug);
    const completed = await this.completedCounts([p.id]);
    // phone is shown to logged-in users only; every disclosure is logged and capped per user (anti-scraping, PDP law)
    let phone: string | null = null;
    if (user && p.phone) {
      if (user.id === p.userId) phone = p.phone;
      else {
        const allowed = await this.rate.hit(`provider-phone:${user.id}`, 60, 3600).then(() => true, () => false);
        if (allowed) {
          phone = p.phone;
          await this.dbs.db.insert(auditLog).values({ actorId: user.id, action: 'reveal_phone', entity: 'service_provider', entityId: p.id, impersonatorId: user.impersonatorId ?? null });
        }
      }
    }
    return { ...this.providerDto(p, completed.get(p.id) ?? 0), reviews: await this.reviewsOf('provider', p.id), phone, isMine: !!user && user.id === p.userId };
  }

  async myProvider(user: AuthUser) {
    const p = await this.dbs.db.query.serviceProviders.findFirst({ where: and(eq(serviceProviders.userId, user.id), isNull(serviceProviders.deletedAt)) });
    if (!p) return null;
    const completed = await this.completedCounts([p.id]);
    const ledger = await this.dbs.db.execute<{ revenue: string | null; commission: string | null; n: string }>(sql`
      SELECT sum(amount_minor) AS revenue, sum(commission_minor) AS commission, count(*) AS n FROM service_orders WHERE provider_id = ${p.id} AND status = 'completed' AND deleted_at IS NULL`);
    return { ...this.providerDto(p, completed.get(p.id) ?? 0), ledger: { revenueMinor: Number(ledger[0]?.revenue ?? 0), commissionMinor: Number(ledger[0]?.commission ?? 0), completed: Number(ledger[0]?.n ?? 0) } };
  }

  /* ---------------- orders ---------------- */

  private async orderDtos(rows: OrderRow[], user: AuthUser): Promise<ServiceOrderDto[]> {
    if (!rows.length) return [];
    const providerIds = [...new Set(rows.map((r) => r.providerId))];
    const provs = await this.dbs.db.select().from(serviceProviders).where(sql`${serviceProviders.id} = ANY(${`{${providerIds.join(',')}}`}::uuid[])`);
    const provBy = new Map(provs.map((p) => [p.id, p]));
    const reqIds = [...new Set(rows.map((r) => r.requesterId))];
    const reqs = await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} = ANY(${`{${reqIds.join(',')}}`}::uuid[])`);
    const reqBy = new Map(reqs.map((u) => [u.id, u]));
    const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x))];
    const ls = listingIds.length ? await this.dbs.db.select({ id: listings.id, slug: listings.slug, title: listings.title }).from(listings).where(sql`${listings.id} = ANY(${`{${listingIds.join(',')}}`}::uuid[])`) : [];
    const lBy = new Map(ls.map((l) => [l.id, l]));
    const reviewed = await this.dbs.db.execute<{ target_id: string }>(sql`SELECT target_id FROM reviews WHERE target_type = 'provider' AND author_id = ${user.id} AND deleted_at IS NULL`);
    const reviewedSet = new Set(reviewed.map((r) => r.target_id));
    return rows.map((r) => {
      const p = provBy.get(r.providerId);
      const role = p?.userId === user.id ? 'provider' : 'requester';
      return {
        id: r.id,
        provider: { id: r.providerId, slug: p?.slug ?? '', name: p?.name ?? '' },
        requester: { id: r.requesterId, name: reqBy.get(r.requesterId)?.name ?? 'მომხმარებელი' },
        listing: r.listingId ? (lBy.get(r.listingId) ?? null) : null,
        category: r.category,
        description: r.description,
        status: r.status,
        quoteMinor: r.quoteMinor,
        quoteNote: r.quoteNote,
        amountMinor: r.amountMinor,
        commissionPct: r.commissionPct,
        commissionMinor: role === 'provider' || user.role === 'admin' ? r.commissionMinor : null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        role,
        canReview: role === 'requester' && r.status === 'completed' && !reviewedSet.has(r.providerId),
      };
    });
  }

  async requestQuote(user: AuthUser, input: { providerId: string; category: string; description: string; listingId?: string | null }) {
    await this.rate.hit(`svc-quote:${user.id}`, 20, 3600);
    const p = await this.dbs.db.query.serviceProviders.findFirst({ where: and(eq(serviceProviders.id, input.providerId), isNull(serviceProviders.deletedAt)) });
    if (!p) throw problems.notFound('მომსახურების მიმწოდებელი');
    if (p.userId === user.id) throw problems.badRequest('საკუთარ თავისთვის შეკვეთა შეუძლებელია');
    if (!p.categories.includes(input.category)) throw new ProblemException(422, 'validation', 'შეყვანილი მონაცემები არასწორია', undefined, { errors: [{ path: 'category', message: 'მიმწოდებელი ამ კატეგორიაში არ მუშავებს' }] });
    const pct = Math.round((await this.settings.number('services_commission_pct')) || 10);
    const [row] = await this.dbs.db
      .insert(serviceOrders)
      .values({ providerId: p.id, requesterId: user.id, listingId: input.listingId ?? null, category: input.category, description: input.description, commissionPct: pct })
      .returning();
    const cat = SERVICE_CATEGORIES.find((c) => c.slug === input.category)?.nameKa ?? input.category;
    await this.notify.notify({ userId: p.userId, template: 'service_request', category: 'services', channels: ['in_app', 'sms'], vars: { category: cat, body: input.description.slice(0, 120) }, link: '/account/services?tab=provider' });
    const [dto] = await this.orderDtos([row!], user);
    return dto!;
  }

  async orders(user: AuthUser, role?: 'provider' | 'requester') {
    const mine = await this.dbs.db.query.serviceProviders.findFirst({ where: and(eq(serviceProviders.userId, user.id), isNull(serviceProviders.deletedAt)) });
    const conds: SQL[] = [];
    if (role !== 'provider') conds.push(sql`${serviceOrders.requesterId} = ${user.id}`);
    if (role !== 'requester' && mine) conds.push(sql`${serviceOrders.providerId} = ${mine.id}`);
    if (!conds.length) return [];
    const rows = await this.dbs.db
      .select()
      .from(serviceOrders)
      .where(and(isNull(serviceOrders.deletedAt), sql`(${sql.join(conds, sql` OR `)})`))
      .orderBy(desc(serviceOrders.updatedAt))
      .limit(200);
    return this.orderDtos(rows, user);
  }

  private async orderFor(user: AuthUser, id: string) {
    const o = await this.dbs.db.query.serviceOrders.findFirst({ where: and(eq(serviceOrders.id, id), isNull(serviceOrders.deletedAt)) });
    if (!o) throw problems.notFound('შეკვეთა');
    const p = await this.dbs.db.query.serviceProviders.findFirst({ where: eq(serviceProviders.id, o.providerId) });
    const isProvider = p?.userId === user.id;
    const isRequester = o.requesterId === user.id;
    if (!isProvider && !isRequester && user.role !== 'admin') throw problems.notFound('შეკვეთა');
    return { o, p: p!, isProvider, isRequester };
  }

  private assertTransition(from: ServiceOrderStatus, to: ServiceOrderStatus, actor: 'provider' | 'requester' | 'admin') {
    const t = SERVICE_ORDER_TRANSITIONS[from].find((x) => x.to === to);
    if (!t) throw problems.invalidTransition(from, to);
    if (actor !== 'admin' && t.by !== 'both' && t.by !== actor) throw problems.forbidden();
  }

  async quote(user: AuthUser, id: string, input: { quoteMinor: number; quoteNote?: string | null }) {
    const { o, p, isProvider } = await this.orderFor(user, id);
    this.assertTransition(o.status, 'quoted', isProvider ? 'provider' : 'requester');
    const [row] = await this.dbs.db.update(serviceOrders).set({ status: 'quoted', quoteMinor: input.quoteMinor, quoteNote: input.quoteNote ?? null }).where(eq(serviceOrders.id, o.id)).returning();
    await this.notify.notify({ userId: o.requesterId, template: 'service_quote', category: 'services', channels: ['in_app', 'sms'], vars: { provider: p.name, price: formatMoney(input.quoteMinor) }, link: '/account/services' });
    const [dto] = await this.orderDtos([row!], user);
    return dto!;
  }

  async accept(user: AuthUser, id: string) {
    const { o, p, isRequester } = await this.orderFor(user, id);
    this.assertTransition(o.status, 'accepted', isRequester ? 'requester' : 'provider');
    const [row] = await this.dbs.db.update(serviceOrders).set({ status: 'accepted', amountMinor: o.quoteMinor }).where(eq(serviceOrders.id, o.id)).returning();
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    await this.notify.notify({ userId: p.userId, template: 'service_accepted', category: 'services', channels: ['in_app', 'sms'], vars: { requester: me?.name ?? 'მომხმარებელი', price: formatMoney(o.quoteMinor ?? 0) }, link: '/account/services?tab=provider' });
    const [dto] = await this.orderDtos([row!], user);
    return dto!;
  }

  /** in_progress / completed (provider) / cancelled (either). Completion records the platform commission. */
  async setStatus(user: AuthUser, id: string, status: 'in_progress' | 'completed' | 'cancelled') {
    const { o, p, isProvider, isRequester } = await this.orderFor(user, id);
    const actor = user.role === 'admin' && !isProvider && !isRequester ? 'admin' : isProvider ? 'provider' : 'requester';
    this.assertTransition(o.status, status, actor);
    const patch: Partial<typeof serviceOrders.$inferInsert> = { status };
    if (status === 'completed') {
      const amount = o.amountMinor ?? o.quoteMinor;
      if (!amount) throw problems.conflict('შეკვეთას ფასი არ აქვს');
      patch.amountMinor = amount;
      patch.commissionMinor = Math.round((amount * o.commissionPct) / 100);
      patch.completedAt = new Date();
    }
    const [row] = await this.dbs.db.update(serviceOrders).set(patch).where(eq(serviceOrders.id, o.id)).returning();
    const notifyUser = isProvider ? o.requesterId : p.userId;
    await this.notify.notify({ userId: notifyUser, template: 'service_status', category: 'services', channels: ['in_app'], vars: { provider: p.name, status: STATUS_KA[status] }, link: isProvider ? '/account/services' : '/account/services?tab=provider' });
    const [dto] = await this.orderDtos([row!], user);
    return dto!;
  }

  /** Only requesters with a completed order may review, once per provider. */
  async review(user: AuthUser, slug: string, input: { rating: number; body?: string | null }) {
    const p = await this.providerBySlug(slug);
    const done = await this.dbs.db.$count(serviceOrders, and(eq(serviceOrders.providerId, p.id), eq(serviceOrders.requesterId, user.id), eq(serviceOrders.status, 'completed')));
    if (!done) throw problems.forbidden('შეფასება — მხოლოდ დასრულებული შეკვეთის შემდეგ');
    const already = await this.dbs.db.$count(reviews, and(eq(reviews.targetType, 'provider'), eq(reviews.targetId, p.id), eq(reviews.authorId, user.id), isNull(reviews.deletedAt)));
    if (already) throw problems.conflict('თქვენ უკვე შეაფასეთ ეს მიმწოდებელი');
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    const [row] = await this.dbs.db.insert(reviews).values({ targetType: 'provider', targetId: p.id, authorId: user.id, authorName: me?.name ?? 'მომხმარებელი', rating: input.rating, body: input.body ?? null }).returning();
    // keep denormalized rating in sync (rating_x10 = avg × 10)
    await this.dbs.db.execute(sql`
      UPDATE service_providers sp SET reviews_count = sub.n, rating_x10 = sub.avg10, updated_at = now()
      FROM (SELECT count(*)::int AS n, round(avg(rating) * 10)::int AS avg10 FROM reviews WHERE target_type = 'provider' AND target_id = ${p.id} AND deleted_at IS NULL) sub
      WHERE sp.id = ${p.id}`);
    return { id: row!.id, authorName: row!.authorName, rating: row!.rating, body: row!.body, createdAt: row!.createdAt.toISOString() } satisfies ReviewDto;
  }
}
