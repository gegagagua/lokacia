import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, coBrokerShares, competitorTracks, desc, eq, inArray, isNull, listings, sql, users } from '@lokacia/db';
import type { CrmListingRow } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ListingReadService } from '../../listings/listing-read.service';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';

/** C9: org listings workspace — cards + agent, 30-day stats, competitor tracks and co-broker shares counts. */
@ApiTags('crm')
@Controller('v1/crm/listings')
@Crm()
export class CrmListingsController {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
  ) {}

  @Get()
  async list(@Ctx() ctx: CrmCtx): Promise<CrmListingRow[]> {
    const rows = await this.dbs.db
      .select({ id: listings.id, agentId: listings.agentId, ownerId: listings.ownerId, rejectReason: listings.rejectReason, updatedAt: listings.updatedAt })
      .from(listings)
      .where(and(eq(listings.orgId, ctx.orgId), isNull(listings.deletedAt), ctx.ownDealsOnly ? sql`(${listings.agentId} = ${ctx.userId} OR ${listings.ownerId} = ${ctx.userId})` : undefined))
      .orderBy(desc(listings.updatedAt))
      .limit(1000);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const cards = await this.read.cards(ids);
    const stats = await this.dbs.db.execute<{ listing_id: string; views: string; reveals: string; saves: string }>(sql`
      SELECT listing_id, sum(views) AS views, sum(reveals) AS reveals, sum(saves) AS saves FROM listing_stats_daily
      WHERE listing_id = ANY(${`{${ids.join(',')}}`}::uuid[]) AND day >= current_date - 30 GROUP BY listing_id`);
    const statBy = new Map(stats.map((s) => [s.listing_id, s]));
    const { tracks, shares } = await this.dbs.org(ctx.orgId, async (tx) => ({
      tracks: await tx
        .select({ listingId: competitorTracks.listingId, n: sql<number>`count(*)::int` })
        .from(competitorTracks)
        .where(and(inArray(competitorTracks.listingId, ids), isNull(competitorTracks.deletedAt)))
        .groupBy(competitorTracks.listingId),
      shares: await tx
        .select({ listingId: coBrokerShares.listingId, n: sql<number>`count(*)::int` })
        .from(coBrokerShares)
        .where(and(inArray(coBrokerShares.listingId, ids), eq(coBrokerShares.fromOrgId, ctx.orgId), isNull(coBrokerShares.deletedAt)))
        .groupBy(coBrokerShares.listingId),
    }));
    const trackBy = new Map(tracks.map((t) => [t.listingId, t.n]));
    const shareBy = new Map(shares.map((t) => [t.listingId, t.n]));
    const agentIds = [...new Set(rows.map((r) => r.agentId ?? r.ownerId))];
    const agents = await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, agentIds));
    const nameBy = new Map(agents.map((a) => [a.id, a.name]));
    const rowBy = new Map(rows.map((r) => [r.id, r]));
    return cards.map((c) => {
      const r = rowBy.get(c.id)!;
      const s = statBy.get(c.id);
      const agentId = r.agentId ?? r.ownerId;
      return {
        ...c,
        agentId,
        agentName: nameBy.get(agentId) ?? null,
        rejectReason: r.rejectReason,
        stats30d: { views: Number(s?.views ?? 0), reveals: Number(s?.reveals ?? 0), saves: Number(s?.saves ?? 0) },
        competitorTracks: trackBy.get(c.id) ?? 0,
        coBrokerShares: shareBy.get(c.id) ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  /** Daily views/reveals/saves for the last 30 days (sparkline on the listing page). */
  @Get(':id/stats')
  async stats(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('განცხადება');
    const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, id), eq(listings.orgId, ctx.orgId), isNull(listings.deletedAt)) });
    if (!l) throw problems.notFound('განცხადება');
    const days = await this.dbs.db.execute<{ day: string; views: number; reveals: number; saves: number }>(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(s.views, 0)::int AS views, coalesce(s.reveals, 0)::int AS reveals, coalesce(s.saves, 0)::int AS saves
      FROM generate_series(current_date - 29, current_date, interval '1 day') d
      LEFT JOIN listing_stats_daily s ON s.listing_id = ${id} AND s.day = d::date
      ORDER BY d`);
    const total = days.reduce((a, d) => ({ views: a.views + d.views, reveals: a.reveals + d.reveals, saves: a.saves + d.saves }), { views: 0, reveals: 0, saves: 0 });
    return { days: [...days], total, inFeed: l.status === 'active' };
  }
}
