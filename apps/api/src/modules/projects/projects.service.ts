import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, listings, memberships, organizations, prebookings, projects, sql, users } from '@lokacia/db';
import type { ProjectDetailDto, ProjectDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import type { AuthUser } from '../../common/request';
import { ListingReadService } from '../listings/listing-read.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

type ProjectRow = typeof projects.$inferSelect;
const UNIT_STATUSES = sql`('active', 'stale', 'rented', 'sold')`;

/** P8 off-plan: developer projects, their units (listings with project_id) and pre-booking requests. */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly tax: TaxonomyService,
    private readonly notify: NotificationsService,
    private readonly rate: RateLimitService,
  ) {}

  private async dtos(rows: ProjectRow[]): Promise<ProjectDto[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const agg = await this.dbs.db.execute<{ project_id: string; n: string; min_price: string | null; min_area: string | null; max_area: string | null }>(sql`
      SELECT project_id, count(*) AS n, min(price_minor) AS min_price, min(area_m2) AS min_area, max(area_m2) AS max_area
      FROM listings WHERE deleted_at IS NULL AND status IN ${UNIT_STATUSES} AND project_id = ANY(${`{${ids.join(',')}}`}::uuid[]) GROUP BY project_id`);
    const aggBy = new Map(agg.map((a) => [a.project_id, a]));
    const orgIds = [...new Set(rows.map((r) => r.orgId))];
    const orgs = await this.dbs.db.select().from(organizations).where(sql`${organizations.id} = ANY(${`{${orgIds.join(',')}}`}::uuid[])`);
    const orgBy = new Map(orgs.map((o) => [o.id, o]));
    const out: ProjectDto[] = [];
    for (const r of rows) {
      const d = await this.tax.districtById(r.districtId);
      const a = aggBy.get(r.id);
      const o = orgBy.get(r.orgId);
      out.push({
        id: r.id,
        slug: r.slug,
        name: r.name,
        address: r.address,
        city: d?.city ?? null,
        district: d ? { slug: d.slug, name: d.nameKa } : null,
        completionDate: r.completionDate,
        description: r.description,
        floors: r.floors,
        coverUrl: r.coverUrl,
        lat: r.lat,
        lng: r.lng,
        developer: { name: o?.name ?? '', slug: o?.slug ?? '', logoUrl: o?.logoUrl ?? null, verified: !!o?.verified },
        unitsCount: Number(a?.n ?? 0),
        minPriceMinor: a?.min_price ? Number(a.min_price) : null,
        minAreaM2: a?.min_area ? Number(a.min_area) : null,
        maxAreaM2: a?.max_area ? Number(a.max_area) : null,
      });
    }
    return out;
  }

  async list(q: { city?: string; org?: string }) {
    const rows = await this.dbs.db.query.projects.findMany({ where: isNull(projects.deletedAt), orderBy: asc(projects.completionDate) });
    let items = await this.dtos(rows);
    if (q.city) items = items.filter((p) => p.city === q.city);
    if (q.org) items = items.filter((p) => p.developer.slug === q.org);
    return items;
  }

  private async bySlug(slug: string) {
    const p = await this.dbs.db.query.projects.findFirst({ where: and(eq(projects.slug, slug), isNull(projects.deletedAt)) });
    if (!p) throw problems.notFound('პროექტი');
    return p;
  }

  async detail(slug: string): Promise<ProjectDetailDto> {
    const p = await this.bySlug(slug);
    const [dto] = await this.dtos([p]);
    const units = await this.dbs.db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.projectId, p.id), isNull(listings.deletedAt), sql`${listings.status} IN ${UNIT_STATUSES}`))
      .orderBy(asc(listings.floor), asc(listings.priceMinor));
    const prebookingsCount = await this.dbs.db.$count(prebookings, and(eq(prebookings.projectId, p.id), isNull(prebookings.deletedAt)));
    return { ...dto!, units: await this.read.cards(units.map((u) => u.id)), prebookingsCount };
  }

  /** Pre-booking request: stored + developer org managers (or listing owner) notified. */
  async prebook(user: AuthUser, input: { projectSlug?: string; listingId?: string | null; message?: string | null; phone?: string | null }) {
    await this.rate.hit(`prebook:${user.id}`, 20, 3600);
    let project: ProjectRow | null = input.projectSlug ? await this.bySlug(input.projectSlug) : null;
    let listing: typeof listings.$inferSelect | null = null;
    if (input.listingId) {
      listing = (await this.read.findRaw(input.listingId)) ?? null;
      if (!listing || !['active', 'stale'].includes(listing.status)) throw problems.notFound('ფართი');
      if (project && listing.projectId !== project.id) throw problems.badRequest('ფართი ამ პროექტს არ ეკუთვნის');
      if (!project && listing.projectId) project = (await this.dbs.db.query.projects.findFirst({ where: eq(projects.id, listing.projectId) })) ?? null;
      if (!project) throw problems.badRequest('წინასწარი ჯავშნა — მხოლოდ მშენებარე პროექტის ფართზე');
    }
    if (!project) throw problems.badRequest('აირჩიეთ პროექტი ან ფართი');
    if (!listing) {
      const first = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.projectId, project.id), eq(listings.status, 'active'), isNull(listings.deletedAt)), orderBy: asc(listings.priceMinor) });
      if (!first) throw problems.conflict('პროექტში თავისუფალი ფართი არ არის');
      listing = first;
    }
    const existing = await this.dbs.db.query.prebookings.findFirst({ where: and(eq(prebookings.listingId, listing.id), eq(prebookings.userId, user.id), isNull(prebookings.deletedAt), sql`${prebookings.status} <> 'cancelled'`) });
    if (existing) return { id: existing.id, status: existing.status, duplicate: true };
    const me = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    const [row] = await this.dbs.db
      .insert(prebookings)
      .values({ listingId: listing.id, projectId: project.id, userId: user.id, message: input.message ?? null, phone: input.phone ?? me?.phone ?? null })
      .returning();
    const managers = await this.dbs.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.orgId, project.orgId), eq(memberships.role, 'manager'), eq(memberships.active, true), isNull(memberships.deletedAt)));
    const recipients = new Set<string>([...managers.map((m) => m.userId).filter((x): x is string => !!x), listing.ownerId]);
    recipients.delete(user.id);
    for (const userId of recipients) {
      await this.notify.notify({ userId, template: 'prebooking', category: 'offers', channels: ['in_app', 'sms'], vars: { title: listing.title, from: me?.name ?? 'მომხმარებელი' }, link: `/listings/${listing.slug}` });
    }
    return { id: row!.id, status: row!.status, duplicate: false };
  }

  async myPrebookings(user: AuthUser) {
    const rows = await this.dbs.db.query.prebookings.findMany({ where: and(eq(prebookings.userId, user.id), isNull(prebookings.deletedAt)), orderBy: desc(prebookings.createdAt) });
    const cards = await this.read.cards(rows.map((r) => r.listingId));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt.toISOString(), message: r.message, listing: byId.get(r.listingId) ?? null }));
  }
}
