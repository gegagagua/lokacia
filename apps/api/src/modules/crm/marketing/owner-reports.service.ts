import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, isNull, listings, ownerReports, sql } from '@lokacia/db';
import type { OwnerReportRow } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { ENV, type Env } from '../../../config/env';
import { NotificationsService } from '../../notifications/notifications.service';

const DAY = 86_400_000;

/** Monday (UTC) of the previous ISO week as YYYY-MM-DD. */
export function previousWeekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - (dow + 7) * DAY).toISOString().slice(0, 10);
}

/**
 * C13 weekly owner report: views/calls(reveals)/saves from listing_stats_daily + CRM viewings for every org listing,
 * stored in owner_reports (one per listing per week) and sent to the owner (or the agent when the agent owns the listing record).
 */
@Injectable()
export class OwnerReportsService implements OnModuleInit {
  private readonly logger = new Logger('OwnerReports');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('crm.owner-reports.weekly', (d: { orgId?: string; weekStart?: string }) => this.run(d?.orgId, d?.weekStart));
    this.queue.every('crm.owner-reports.weekly', DAY);
  }

  async run(orgId?: string, weekStart = previousWeekStart()) {
    const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 7 * DAY).toISOString().slice(0, 10);
    const ls = await this.dbs.db
      .select({ id: listings.id, orgId: listings.orgId, title: listings.title, slug: listings.slug, ownerId: listings.ownerId, agentId: listings.agentId })
      .from(listings)
      .where(and(isNotNull(listings.orgId), orgId ? eq(listings.orgId, orgId) : undefined, isNull(listings.deletedAt), inArray(listings.status, ['active', 'stale'])));
    if (!ls.length) return { weekStart, created: 0, sent: 0 };
    const ids = ls.map((l) => l.id);
    const idsArr = `{${ids.join(',')}}`;
    const stats = await this.dbs.db.execute<{ listing_id: string; views: string; reveals: string; saves: string }>(sql`
      SELECT listing_id, sum(views) AS views, sum(reveals) AS reveals, sum(saves) AS saves FROM listing_stats_daily
      WHERE listing_id = ANY(${idsArr}::uuid[]) AND day >= ${weekStart}::date AND day < ${weekEnd}::date GROUP BY listing_id`);
    const statBy = new Map(stats.map((s) => [s.listing_id, s]));
    const result = await this.dbs.system(async (tx) => {
      const views = await tx.execute<{ listing_id: string; n: number }>(sql`
        SELECT listing_id, count(*)::int AS n FROM crm_viewings
        WHERE listing_id = ANY(${idsArr}::uuid[]) AND deleted_at IS NULL AND status <> 'cancelled' AND starts_at >= ${weekStart}::date AND starts_at < ${weekEnd}::date
        GROUP BY listing_id`);
      const existing = await tx.select({ listingId: ownerReports.listingId }).from(ownerReports).where(and(inArray(ownerReports.listingId, ids), eq(ownerReports.weekStart, weekStart), isNull(ownerReports.deletedAt)));
      const done = new Set(existing.map((e) => e.listingId));
      const viewingsBy = new Map(views.map((v) => [v.listing_id, v.n]));
      const created: { id: string; listing: (typeof ls)[number]; payload: { views: number; reveals: number; saves: number; viewings: number } }[] = [];
      for (const l of ls) {
        if (done.has(l.id)) continue;
        const s = statBy.get(l.id);
        const payload = { views: Number(s?.views ?? 0), reveals: Number(s?.reveals ?? 0), saves: Number(s?.saves ?? 0), viewings: viewingsBy.get(l.id) ?? 0 };
        const [row] = await tx.insert(ownerReports).values({ orgId: l.orgId!, listingId: l.id, weekStart, payload }).returning({ id: ownerReports.id });
        created.push({ id: row!.id, listing: l, payload });
      }
      return created;
    });
    let sent = 0;
    for (const r of result) {
      if (await this.send(r.id, r.listing, r.payload)) sent++;
    }
    if (result.length) this.logger.log(`week ${weekStart}: ${result.length} reports, ${sent} sent`);
    return { weekStart, created: result.length, sent };
  }

  private async send(reportId: string, l: { orgId: string | null; title: string; slug: string; ownerId: string; agentId: string | null }, p: { views: number; reveals: number; saves: number; viewings: number }) {
    const ownerIsAgent = !l.agentId || l.agentId === l.ownerId;
    try {
      await this.notify.notify({
        userId: l.ownerId,
        template: 'crm_owner_report',
        vars: { title: l.title, views: p.views, reveals: p.reveals, viewings: p.viewings },
        link: ownerIsAgent ? `${this.env.CRM_URL}/owner-reports` : `${this.env.APP_URL}/listings/${l.slug}`,
        channels: ownerIsAgent ? ['in_app', 'telegram'] : ['sms', 'email', 'telegram', 'in_app'],
        category: 'crm',
      });
      await this.dbs.system((tx) => tx.update(ownerReports).set({ sentAt: new Date() }).where(eq(ownerReports.id, reportId)));
      return true;
    } catch (e) {
      this.logger.warn(`owner report ${reportId} not sent: ${(e as Error).message}`);
      return false;
    }
  }

  async list(orgId: string): Promise<OwnerReportRow[]> {
    const rows = await this.dbs.org(orgId, (tx) => tx.select().from(ownerReports).where(isNull(ownerReports.deletedAt)).orderBy(desc(ownerReports.weekStart), desc(ownerReports.createdAt)).limit(500));
    const ids = [...new Set(rows.map((r) => r.listingId))];
    const ls = ids.length ? await this.dbs.db.select({ id: listings.id, title: listings.title, slug: listings.slug }).from(listings).where(inArray(listings.id, ids)) : [];
    const by = new Map(ls.map((l) => [l.id, l]));
    return rows.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      listingTitle: by.get(r.listingId)?.title ?? '—',
      listingSlug: by.get(r.listingId)?.slug ?? null,
      weekStart: r.weekStart,
      payload: r.payload,
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async get(orgId: string, id: string) {
    const row = (await this.list(orgId)).find((r) => r.id === id);
    if (!row) throw problems.notFound('რეპორტი');
    return row;
  }
}
