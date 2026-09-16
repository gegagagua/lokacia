import { Injectable } from '@nestjs/common';
import { and, auditLog, desc, eq, isNull, memberships, organizations, projects, reviews, sql, users } from '@lokacia/db';
import type { AgencyProfileDto, BrokerProfileDto, ReviewDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import type { AuthUser } from '../../common/request';
import { ListingReadService } from '../listings/listing-read.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

const BROKER_ROLES = ['broker', 'agency_manager', 'agency_assistant', 'developer'];

/** C12 public part: broker mini-sites and agency pages, reviews. */
@Injectable()
export class ProfilesService {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly tax: TaxonomyService,
    private readonly rate: RateLimitService,
  ) {}

  private async reviewsFor(where: ReturnType<typeof sql>, limit = 30): Promise<{ items: ReviewDto[]; avg: number | null; count: number }> {
    const rows = await this.dbs.db.execute<{ id: string; author_name: string; rating: number; body: string | null; created_at: string }>(sql`
      SELECT id, author_name, rating, body, created_at FROM reviews WHERE deleted_at IS NULL AND ${where} ORDER BY created_at DESC LIMIT ${limit}`);
    const agg = await this.dbs.db.execute<{ avg: string | null; n: string }>(sql`SELECT avg(rating) AS avg, count(*) AS n FROM reviews WHERE deleted_at IS NULL AND ${where}`);
    return {
      items: rows.map((r) => ({ id: r.id, authorName: r.author_name, rating: r.rating, body: r.body, createdAt: new Date(r.created_at).toISOString() })),
      avg: agg[0]?.avg ? Math.round(Number(agg[0].avg) * 10) / 10 : null,
      count: Number(agg[0]?.n ?? 0),
    };
  }

  private async brokerUser(slug: string) {
    const u = await this.dbs.db.query.users.findFirst({ where: and(eq(users.slug, slug), isNull(users.deletedAt), isNull(users.bannedAt)) });
    if (!u) throw problems.notFound('ბროკერი');
    return u;
  }

  async brokers(q: { district?: string; q?: string; limit?: number }) {
    const d = q.district ? await this.tax.districtBySlug(q.district) : null;
    const rows = await this.dbs.db.execute<{ id: string; name: string; slug: string; avatar_url: string | null; bio: string | null; org_name: string | null; org_slug: string | null; active: string; rating: string | null; reviews: string }>(sql`
      SELECT u.id, u.name, u.slug, u.avatar_url, u.bio, o.name AS org_name, o.slug AS org_slug,
        (SELECT count(*) FROM listings l WHERE l.deleted_at IS NULL AND l.status = 'active' AND (l.agent_id = u.id OR (l.owner_id = u.id AND l.is_owner = false))
          ${d ? sql`AND l.district_id = ${d.id}` : sql``}) AS active,
        (SELECT avg(rating) FROM reviews r WHERE r.target_type = 'broker' AND r.target_id = u.id AND r.deleted_at IS NULL) AS rating,
        (SELECT count(*) FROM reviews r WHERE r.target_type = 'broker' AND r.target_id = u.id AND r.deleted_at IS NULL) AS reviews
      FROM users u
      LEFT JOIN LATERAL (SELECT org_id FROM memberships m WHERE m.user_id = u.id AND m.active AND m.deleted_at IS NULL ORDER BY m.created_at LIMIT 1) m ON true
      LEFT JOIN organizations o ON o.id = m.org_id
      WHERE u.deleted_at IS NULL AND u.banned_at IS NULL AND u.slug IS NOT NULL AND u.role = ANY(${`{${BROKER_ROLES.join(',')}}`}::text[])
        ${q.q ? sql`AND u.name ILIKE ${`%${q.q.replace(/[%_]/g, '')}%`}` : sql``}
      ORDER BY active DESC, reviews DESC LIMIT ${q.limit ?? 60}`);
    return rows
      .filter((r) => !d || Number(r.active) > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        avatarUrl: r.avatar_url,
        bio: r.bio,
        org: r.org_slug ? { name: r.org_name!, slug: r.org_slug } : null,
        activeListings: Number(r.active),
        rating: r.rating ? Math.round(Number(r.rating) * 10) / 10 : null,
        reviewsCount: Number(r.reviews),
      }));
  }

  async broker(slug: string): Promise<BrokerProfileDto> {
    const u = await this.brokerUser(slug);
    const m = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.userId, u.id), eq(memberships.active, true), isNull(memberships.deletedAt)) });
    const org = m ? await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, m.orgId) }) : null;
    const listingRows = await this.dbs.db.execute<{ id: string; status: string; district_id: string | null }>(sql`
      SELECT id, status, district_id FROM listings
      WHERE deleted_at IS NULL AND (agent_id = ${u.id} OR owner_id = ${u.id}) AND status IN ('active', 'rented', 'sold')
      ORDER BY (vip_until > now()) DESC NULLS LAST, published_at DESC NULLS LAST`);
    const active = listingRows.filter((r) => r.status === 'active');
    const districtIds = [...new Set(active.map((r) => r.district_id).filter((x): x is string => !!x))];
    const districts = (await Promise.all(districtIds.map((id) => this.tax.districtById(id)))).filter((d) => !!d).map((d) => d.nameKa);
    const rv = await this.reviewsFor(sql`target_type = 'broker' AND target_id = ${u.id}`);
    return {
      id: u.id,
      slug: u.slug!,
      name: u.name ?? 'ბროკერი',
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      role: u.role,
      memberSince: u.createdAt.toISOString(),
      org: org ? { name: org.name, slug: org.slug, logoUrl: org.logoUrl, verified: org.verified } : null,
      rating: rv.avg,
      reviewsCount: rv.count,
      reviews: rv.items,
      listings: await this.read.cards(active.slice(0, 60).map((r) => r.id)),
      stats: { active: active.length, closed: listingRows.length - active.length, districts: districts.slice(0, 8) },
    };
  }

  async revealBrokerPhone(slug: string, ipHash: string, user?: AuthUser) {
    await this.rate.hit(`broker-reveal:${ipHash}`, 20, 3600);
    if (user) await this.rate.hit(`broker-reveal:u:${user.id}`, 40, 3600);
    const u = await this.brokerUser(slug);
    // every reveal is logged (CLAUDE.md personal data rule), like listing reveals in listing_events
    await this.dbs.db.insert(auditLog).values({ actorId: user?.id ?? null, action: 'reveal_phone', entity: 'broker', entityId: u.id, ip: ipHash, impersonatorId: user?.impersonatorId ?? null });
    return { phone: u.phone, name: u.name };
  }

  private async org(slug: string) {
    const o = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.slug, slug), isNull(organizations.deletedAt)) });
    if (!o) throw problems.notFound('ორგანიზაცია');
    return o;
  }

  async agency(slug: string): Promise<AgencyProfileDto> {
    const o = await this.org(slug);
    const team = await this.dbs.db.execute<{ id: string; name: string | null; slug: string | null; avatar_url: string | null; role: string; active: string }>(sql`
      SELECT u.id, u.name, u.slug, u.avatar_url, m.role,
        (SELECT count(*) FROM listings l WHERE l.deleted_at IS NULL AND l.status = 'active' AND (l.agent_id = u.id OR l.owner_id = u.id)) AS active
      FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ${o.id} AND m.active AND m.deleted_at IS NULL AND u.deleted_at IS NULL
      ORDER BY CASE m.role WHEN 'manager' THEN 0 WHEN 'agent' THEN 1 ELSE 2 END, u.name`);
    const listingRows = await this.dbs.db.execute<{ id: string; status: string }>(sql`
      SELECT id, status FROM listings WHERE deleted_at IS NULL AND org_id = ${o.id} AND status IN ('active', 'rented', 'sold')
      ORDER BY (vip_until > now()) DESC NULLS LAST, published_at DESC NULLS LAST`);
    const active = listingRows.filter((r) => r.status === 'active');
    const teamIds = team.map((t) => t.id);
    const rv = await this.reviewsFor(
      teamIds.length
        ? sql`((target_type = 'org' AND target_id = ${o.id}) OR (target_type = 'broker' AND target_id = ANY(${`{${teamIds.join(',')}}`}::uuid[])))`
        : sql`target_type = 'org' AND target_id = ${o.id}`,
    );
    const projs = await this.dbs.db.query.projects.findMany({ where: and(eq(projects.orgId, o.id), isNull(projects.deletedAt)), orderBy: desc(projects.completionDate) });
    return {
      id: o.id,
      slug: o.slug,
      name: o.name,
      type: o.type,
      about: o.about,
      logoUrl: o.logoUrl,
      address: o.address,
      website: o.website,
      verified: o.verified,
      memberSince: o.createdAt.toISOString(),
      rating: rv.avg,
      reviewsCount: rv.count,
      reviews: rv.items,
      team: team.map((t) => ({ id: t.id, name: t.name ?? 'აგენტი', slug: t.slug, avatarUrl: t.avatar_url, role: t.role, activeListings: Number(t.active) })),
      listings: await this.read.cards(active.slice(0, 60).map((r) => r.id)),
      projects: projs.map((p) => ({ slug: p.slug, name: p.name, completionDate: p.completionDate })),
      stats: { active: active.length, closed: listingRows.length - active.length },
    };
  }

  async review(user: AuthUser, kind: 'broker' | 'org', slug: string, input: { rating: number; body?: string | null }) {
    const targetId = kind === 'broker' ? (await this.brokerUser(slug)).id : (await this.org(slug)).id;
    if (targetId === user.id) throw problems.badRequest('საკუთარ თავის შეფასება შეუძლებელია');
    if (kind === 'org') {
      const member = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, targetId), eq(memberships.userId, user.id), isNull(memberships.deletedAt)) });
      if (member) throw problems.badRequest('საკუთარ ორგანიზაციის შეფასება შეუძლებელია');
    }
    const already = await this.dbs.db.$count(reviews, and(eq(reviews.targetType, kind), eq(reviews.targetId, targetId), eq(reviews.authorId, user.id), isNull(reviews.deletedAt)));
    if (already) throw problems.conflict('თქვენ უკვე დატოვეთ შეფასება');
    await this.rate.hit(`review:${user.id}`, 10, 86400);
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    const [row] = await this.dbs.db.insert(reviews).values({ targetType: kind, targetId, authorId: user.id, authorName: me?.name ?? 'მომხმარებელი', rating: input.rating, body: input.body ?? null }).returning();
    return { id: row!.id, authorName: row!.authorName, rating: row!.rating, body: row!.body, createdAt: row!.createdAt.toISOString() } satisfies ReviewDto;
  }
}
