import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, asc, auditLog, count, desc, eq, inArray, isNull, listings, organizations, ownerVerifications, sql, users } from '@lokacia/db';
import {
  REJECT_REASON_TEMPLATES_KA, decodeCursor, encodeCursor, moderationBulkSchema, moderationDecisionSchema, priceDelta, pricePerM2Minor, type AuditEntryDto, type ModerationDetail,
  type ModerationQueueItem, type VerificationDto,
} from '@lokacia/contracts';
import { CurrentUser, Roles } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { GeoService } from '../geo/geo.service';
import { ListingReadService } from '../listings/listing-read.service';
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';

const uuid = z.string().uuid();

export async function auditFor(dbs: DbService, where: ReturnType<typeof and>, limit = 50): Promise<AuditEntryDto[]> {
  const rows = await dbs.db
    .select({ a: auditLog, actorName: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
  return rows.map(({ a, actorName }) => ({ id: a.id, actorId: a.actorId, actorName, impersonatorId: a.impersonatorId, orgId: a.orgId, action: a.action, entity: a.entity, entityId: a.entityId, diff: a.diff, ip: a.ip, createdAt: a.createdAt.toISOString() }));
}

/** Phase 4: moderation queue and owner verification review. Mutations are audited by the global interceptor. */
@ApiTags('admin')
@Roles('moderator')
@Controller('v1/admin')
export class ModerationController {
  constructor(
    private readonly dbs: DbService,
    private readonly listings: ListingsService,
    private readonly read: ListingReadService,
    private readonly geo: GeoService,
    private readonly notify: NotificationsService,
    private readonly search: SearchService,
  ) {}

  @Get('moderation/reject-reasons')
  reasons() {
    return REJECT_REASON_TEMPLATES_KA;
  }

  @Get('moderation/listings')
  async queue(@Query('cursor') cursor?: string, @Query('limit') limitRaw?: string, @Query('city') city?: string) {
    const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
    const c = decodeCursor<{ at: string; id: string }>(cursor);
    const base = and(eq(listings.status, 'pending_review'), isNull(listings.deletedAt), city ? eq(listings.city, city) : undefined);
    const rows = await this.dbs.db
      .select({ l: listings, ownerName: users.name, ownerPhone: users.phone, orgName: organizations.name })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.ownerId))
      .leftJoin(organizations, eq(organizations.id, listings.orgId))
      .where(and(base, c ? sql`(${listings.updatedAt}, ${listings.id}) > (${c.at}::timestamptz, ${c.id}::uuid)` : undefined))
      .orderBy(asc(listings.updatedAt), asc(listings.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const cards = await this.read.cards(page.map((r) => r.l.id));
    const total = await this.dbs.db.select({ n: count() }).from(listings).where(base);
    const items: ModerationQueueItem[] = [];
    for (const { l, ownerName, ownerPhone, orgName } of page) {
      const card = cards.find((x) => x.id === l.id);
      const avg = l.districtId && l.dealType !== 'sale' && l.dealType !== 'transfer' ? await this.geo.avgPriceM2(l.districtId, l.businessTypes[0]) : null;
      items.push({
        id: l.id, slug: l.slug, title: l.title, dealType: l.dealType, businessTypes: l.businessTypes, priceMinor: l.priceMinor, areaM2: l.areaM2, address: l.address, city: l.city,
        districtName: card?.districtName ?? null, cover: card?.cover ?? null, photosCount: card?.photosCount ?? 0, owner: { id: l.ownerId, name: ownerName, phone: ownerPhone }, orgName,
        submittedAt: l.updatedAt.toISOString(), priceDeltaPct: priceDelta(l.priceMinor, l.areaM2, avg)?.deltaPct ?? null,
      });
    }
    const last = page.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor({ at: last.l.updatedAt.toISOString(), id: last.l.id }) : null, total: total[0]?.n ?? 0 };
  }

  @Get('moderation/listings/:id')
  async detail(@Param('id') id: string): Promise<ModerationDetail> {
    const l = await this.read.findRaw(uuid.parse(id));
    if (!l) throw problems.notFound('განცხადება');
    const listing = await this.read.detail(l);
    const owner = await this.dbs.db.query.users.findFirst({ where: eq(users.id, l.ownerId) });
    const stats = await this.dbs.db.execute<{ total: string; rejected: string }>(sql`SELECT count(*) AS total, count(*) FILTER (WHERE status = 'rejected') AS rejected FROM listings WHERE owner_id = ${l.ownerId} AND deleted_at IS NULL`);
    const avg = l.districtId ? await this.geo.avgPriceM2(l.districtId, l.businessTypes[0]) : null;
    const delta = l.dealType === 'rent' || l.dealType === 'short_term' ? priceDelta(l.priceMinor, l.areaM2, avg) : null;
    const ver = await this.dbs.db.query.ownerVerifications.findFirst({ where: eq(ownerVerifications.listingId, l.id), orderBy: desc(ownerVerifications.createdAt) });
    return {
      listing,
      owner: { id: l.ownerId, name: owner?.name ?? null, phone: owner?.phone ?? null, createdAt: owner?.createdAt.toISOString() ?? '', listingsCount: Number(stats[0]?.total ?? 0), rejectedCount: Number(stats[0]?.rejected ?? 0), bannedAt: owner?.bannedAt?.toISOString() ?? null },
      priceCheck: { districtAvgM2Minor: avg, priceM2Minor: pricePerM2Minor(l.priceMinor, l.areaM2), deltaPct: delta?.deltaPct ?? null, verdict: delta?.verdict ?? null },
      verification: ver ? await this.verificationDto(ver) : null,
      audit: await auditFor(this.dbs, and(eq(auditLog.entityId, l.id)), 30),
    };
  }

  @Post('moderation/listings/:id/approve')
  @HttpCode(200)
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.listings.changeStatus(user, uuid.parse(id), 'active');
    return { ok: true, status: r.status };
  }

  @Post('moderation/listings/:id/reject')
  @HttpCode(200)
  @ApiZodBody(moderationDecisionSchema)
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(moderationDecisionSchema) body: z.infer<typeof moderationDecisionSchema>) {
    const r = await this.listings.changeStatus(user, uuid.parse(id), 'rejected', body.reason);
    return { ok: true, status: r.status };
  }

  @Post('moderation/listings/bulk')
  @HttpCode(200)
  @ApiZodBody(moderationBulkSchema)
  async bulk(@CurrentUser() user: AuthUser, @ZBody(moderationBulkSchema) body: z.infer<typeof moderationBulkSchema>) {
    if (body.action === 'reject' && !body.reason) throw problems.badRequest('უარყოფისთვის მიუთითეთ მიზეზი');
    let ok = 0;
    const failed: { id: string; error: string }[] = [];
    for (const id of body.ids) {
      try {
        await this.listings.changeStatus(user, id, body.action === 'approve' ? 'active' : 'rejected', body.reason);
        ok++;
      } catch (e) {
        failed.push({ id, error: (e as { response?: { title?: string } }).response?.title ?? (e as Error).message });
      }
    }
    return { ok, failed };
  }

  /* ---------------- owner verification ---------------- */

  private async verificationDto(v: typeof ownerVerifications.$inferSelect): Promise<VerificationDto> {
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, v.listingId) });
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, v.userId) });
    const cover = l ? ((await this.read.cards([l.id]))[0]?.cover ?? null) : null;
    return {
      id: v.id, status: v.status, documentUrl: v.documentUrl, note: v.note, createdAt: v.createdAt.toISOString(), reviewedAt: v.reviewedAt?.toISOString() ?? null,
      listing: { id: v.listingId, slug: l?.slug ?? '', title: l?.title ?? '', address: l?.address ?? '', cover }, user: { id: v.userId, name: u?.name ?? null, phone: u?.phone ?? null },
    };
  }

  @Get('verifications')
  async verifications(@Query('status') status?: string) {
    const st = (['pending', 'approved', 'rejected'] as const).find((s) => s === status) ?? 'pending';
    const rows = await this.dbs.db.select().from(ownerVerifications).where(and(eq(ownerVerifications.status, st), isNull(ownerVerifications.deletedAt))).orderBy(st === 'pending' ? asc(ownerVerifications.createdAt) : desc(ownerVerifications.reviewedAt)).limit(200);
    return Promise.all(rows.map((r) => this.verificationDto(r)));
  }

  private async review(user: AuthUser, id: string, approve: boolean, reason?: string) {
    const v = await this.dbs.db.query.ownerVerifications.findFirst({ where: eq(ownerVerifications.id, uuid.parse(id)) });
    if (!v) throw problems.notFound('ვერიფიკაცია');
    if (v.status !== 'pending') throw problems.conflict('ვერიფიკაცია უკვე განხილულია');
    const [row] = await this.dbs.db.update(ownerVerifications).set({ status: approve ? 'approved' : 'rejected', reviewedBy: user.id, reviewedAt: new Date(), note: reason ?? null }).where(eq(ownerVerifications.id, v.id)).returning();
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, v.listingId) });
    if (approve) {
      await this.dbs.db.update(listings).set({ verifiedOwner: true }).where(eq(listings.id, v.listingId));
      await this.search.listingChanged(v.listingId);
      await this.notify.notify({ userId: v.userId, template: 'verification_approved', vars: { title: l?.title ?? '' }, link: `/listings/${l?.slug ?? ''}` });
    } else {
      await this.notify.notify({ userId: v.userId, template: 'verification_rejected', vars: { title: l?.title ?? '', reason: reason ?? '' }, link: '/account/listings' });
    }
    return this.verificationDto(row!);
  }

  @Post('verifications/:id/approve')
  @HttpCode(200)
  approveVerification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.review(user, id, true);
  }

  @Post('verifications/:id/reject')
  @HttpCode(200)
  @ApiZodBody(moderationDecisionSchema)
  rejectVerification(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(moderationDecisionSchema) body: z.infer<typeof moderationDecisionSchema>) {
    return this.review(user, id, false, body.reason);
  }
}
void inArray;
