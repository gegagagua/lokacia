import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, competitorPriceChanges, competitorTracks, desc, eq, inArray, isNull, listings, sql } from '@lokacia/db';
import { detectPortal, formatMoney, type CompetitorPriceChange, type CompetitorTrackInput, type CompetitorTrackRow } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { ENV, type Env } from '../../../config/env';
import { COMPETITORS, type CompetitorPriceChecker } from '../../../integrations/competitors/competitors';
import { NotificationsService } from '../../notifications/notifications.service';
import type { CrmCtx } from '../shared/crm-access';

type Track = typeof competitorTracks.$inferSelect;

/**
 * C15 competitor monitoring: manually tracked URLs of the same space on other portals, periodic price checks through
 * the CompetitorPriceChecker adapter (mock in dev; real scraping must respect robots.txt/ToS — HUMAN_TODO), price change log.
 */
@Injectable()
export class CompetitorsService implements OnModuleInit {
  private readonly logger = new Logger('Competitors');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly notify: NotificationsService,
    @Inject(COMPETITORS) private readonly checker: CompetitorPriceChecker,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('crm.competitors.check', () => this.checkAll());
    this.queue.every('crm.competitors.check', 12 * 3600_000);
  }

  private async toRows(orgId: string, tracks: Track[]): Promise<CompetitorTrackRow[]> {
    const listingIds = [...new Set(tracks.map((t) => t.listingId).filter((x): x is string => !!x))];
    const ls = listingIds.length ? await this.dbs.db.select({ id: listings.id, title: listings.title, priceMinor: listings.priceMinor }).from(listings).where(inArray(listings.id, listingIds)) : [];
    const lBy = new Map(ls.map((l) => [l.id, l]));
    const ids = tracks.map((t) => t.id);
    const counts = ids.length
      ? await this.dbs.org(orgId, (tx) =>
          tx.select({ trackId: competitorPriceChanges.trackId, n: sql<number>`count(*)::int` }).from(competitorPriceChanges).where(and(inArray(competitorPriceChanges.trackId, ids), isNull(competitorPriceChanges.deletedAt))).groupBy(competitorPriceChanges.trackId),
        )
      : [];
    const cBy = new Map(counts.map((c) => [c.trackId, c.n]));
    return tracks.map((t) => ({
      id: t.id,
      listingId: t.listingId,
      listingTitle: t.listingId ? (lBy.get(t.listingId)?.title ?? null) : null,
      listingPriceMinor: t.listingId ? (lBy.get(t.listingId)?.priceMinor ?? null) : null,
      url: t.url,
      portal: t.portal,
      lastPriceMinor: t.lastPriceMinor,
      lastCheckedAt: t.lastCheckedAt?.toISOString() ?? null,
      status: t.status,
      changesCount: cBy.get(t.id) ?? 0,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async list(ctx: CrmCtx, listingId?: string) {
    const rows = await this.dbs.org(ctx.orgId, (tx) =>
      tx
        .select()
        .from(competitorTracks)
        .where(and(isNull(competitorTracks.deletedAt), listingId ? eq(competitorTracks.listingId, listingId) : undefined))
        .orderBy(desc(competitorTracks.createdAt)),
    );
    return this.toRows(ctx.orgId, rows);
  }

  private async find(orgId: string, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('ბმული');
    const t = await this.dbs.org(orgId, (tx) => tx.query.competitorTracks.findFirst({ where: and(eq(competitorTracks.id, id), isNull(competitorTracks.deletedAt)) }));
    if (!t) throw problems.notFound('ბმული');
    return t;
  }

  async create(ctx: CrmCtx, input: CompetitorTrackInput) {
    if (input.listingId) {
      const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, input.listingId), eq(listings.orgId, ctx.orgId), isNull(listings.deletedAt)) });
      if (!l) throw problems.notFound('განცხადება');
    }
    const dup = await this.dbs.org(ctx.orgId, (tx) => tx.query.competitorTracks.findFirst({ where: and(eq(competitorTracks.url, input.url), isNull(competitorTracks.deletedAt)) }));
    if (dup) throw problems.conflict('ეს ბმული უკვე თვალყურის დევნებაშია');
    const [row] = await this.dbs.org(ctx.orgId, (tx) =>
      tx.insert(competitorTracks).values({ orgId: ctx.orgId, listingId: input.listingId ?? null, url: input.url, portal: input.portal?.trim() || detectPortal(input.url) }).returning(),
    );
    // first price reading right away (adapter; mock in dev)
    const checked = await this.checkTrack(row!).catch(() => row!);
    return (await this.toRows(ctx.orgId, [checked]))[0]!;
  }

  async update(ctx: CrmCtx, id: string, patch: Partial<CompetitorTrackInput> & { status?: 'active' | 'removed' }) {
    await this.find(ctx.orgId, id);
    const [row] = await this.dbs.org(ctx.orgId, (tx) =>
      tx
        .update(competitorTracks)
        .set({ ...(patch.url ? { url: patch.url, portal: patch.portal ?? detectPortal(patch.url) } : {}), ...(patch.portal ? { portal: patch.portal } : {}), ...(patch.listingId !== undefined ? { listingId: patch.listingId } : {}), ...(patch.status ? { status: patch.status } : {}) })
        .where(eq(competitorTracks.id, id))
        .returning(),
    );
    return (await this.toRows(ctx.orgId, [row!]))[0]!;
  }

  async remove(ctx: CrmCtx, id: string) {
    await this.find(ctx.orgId, id);
    await this.dbs.org(ctx.orgId, (tx) => tx.update(competitorTracks).set({ deletedAt: new Date() }).where(eq(competitorTracks.id, id)));
    return { ok: true };
  }

  async check(ctx: CrmCtx, id: string) {
    const t = await this.find(ctx.orgId, id);
    const row = await this.checkTrack(t);
    return (await this.toRows(ctx.orgId, [row]))[0]!;
  }

  async changes(ctx: CrmCtx, id: string): Promise<CompetitorPriceChange[]> {
    await this.find(ctx.orgId, id);
    const rows = await this.dbs.org(ctx.orgId, (tx) => tx.select().from(competitorPriceChanges).where(and(eq(competitorPriceChanges.trackId, id), isNull(competitorPriceChanges.deletedAt))).orderBy(desc(competitorPriceChanges.createdAt)).limit(200));
    return rows.map((r) => ({ id: r.id, oldPriceMinor: r.oldPriceMinor, newPriceMinor: r.newPriceMinor, createdAt: r.createdAt.toISOString() }));
  }

  /** Reads the current price; logs a change and notifies the listing agent; `null` from the adapter → removed. */
  async checkTrack(t: Track): Promise<Track> {
    const now = new Date();
    let price: number | null;
    try {
      price = await this.checker.check(t.url, t.lastPriceMinor);
    } catch (e) {
      this.logger.warn(`check ${t.url} failed: ${(e as Error).message}`);
      const [row] = await this.dbs.org(t.orgId, (tx) => tx.update(competitorTracks).set({ status: 'error', lastCheckedAt: now }).where(eq(competitorTracks.id, t.id)).returning());
      return row!;
    }
    if (price === null) {
      const [row] = await this.dbs.org(t.orgId, (tx) => tx.update(competitorTracks).set({ status: 'removed', lastCheckedAt: now }).where(eq(competitorTracks.id, t.id)).returning());
      return row!;
    }
    const changed = t.lastPriceMinor !== null && t.lastPriceMinor !== price;
    const row = await this.dbs.org(t.orgId, async (tx) => {
      if (changed || t.lastPriceMinor === null) {
        await tx.insert(competitorPriceChanges).values({ orgId: t.orgId, trackId: t.id, oldPriceMinor: t.lastPriceMinor, newPriceMinor: price });
      }
      const [r] = await tx.update(competitorTracks).set({ lastPriceMinor: price, lastCheckedAt: now, status: 'active' }).where(eq(competitorTracks.id, t.id)).returning();
      return r!;
    });
    if (changed && t.listingId) {
      const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, t.listingId) });
      const userId = l?.agentId ?? l?.ownerId;
      if (userId) {
        await this.notify.notify({
          userId,
          template: 'crm_competitor_price',
          vars: { portal: t.portal, old: formatMoney(t.lastPriceMinor!), new: formatMoney(price) },
          link: `${this.env.CRM_URL}/competitors`,
          channels: ['in_app', 'telegram'],
        });
      }
    }
    return row;
  }

  async checkAll() {
    const tracks = await this.dbs.system((tx) => tx.select().from(competitorTracks).where(and(eq(competitorTracks.status, 'active'), isNull(competitorTracks.deletedAt))));
    let changed = 0;
    for (const t of tracks) {
      const r = await this.checkTrack(t).catch(() => t);
      if (r.lastPriceMinor !== t.lastPriceMinor) changed++;
    }
    return { checked: tracks.length, changed };
  }
}
