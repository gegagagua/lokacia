import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull, listings, savedSearches, sql } from '@lokacia/db';
import {
  describeFilters, formatMoney, paramsToFilters, searchFiltersSchema, type AlertChannel, type SavedSearchDto, type SearchFilters, type SearchQuery,
} from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import type { AuthUser } from '../../common/request';
import { ENV, type Env } from '../../config/env';
import { registerTemplates } from '../notifications/templates';
import { NotificationsService, type Channel } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';

type Row = typeof savedSearches.$inferSelect;

registerTemplates({
  listing_alert: {
    title: () => 'ახალი ფართი თქვენი ძებნით',
    body: (v) => `„${v.search}“ — ${v.title}, ${v.price}${v.unsubscribe ? `\nგამოწერის გაუქმება: ${v.unsubscribe}` : ''}`,
  },
});

/** P7: saved searches + instant alerts on `listings.published`. */
@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger('Alerts');
  constructor(
    private readonly dbs: DbService,
    private readonly search: SearchService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('listings.published', (d: { listingId: string }) => this.onPublished(d.listingId));
  }

  private normalize(query: unknown): SearchFilters {
    const parsed = searchFiltersSchema.safeParse(query);
    if (parsed.success) return parsed.data;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries((query ?? {}) as Record<string, unknown>)) {
      if (v == null) continue;
      params[k] = Array.isArray(v) ? v.join(',') : String(v);
    }
    return paramsToFilters(params);
  }

  private clean(filters: SearchFilters): SearchFilters {
    // bbox/cursor-like view state must not become part of an alert
    const { sort: _s, ...rest } = filters;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)) as SearchFilters;
  }

  private async toDto(r: Row): Promise<SavedSearchDto> {
    const query = this.normalize(r.query);
    const since = r.lastNotifiedAt ?? new Date(Date.now() - 7 * 86_400_000);
    const [all, fresh] = await Promise.all([
      this.search.engine.search({ ...query, limit: 1 } as SearchQuery),
      this.dbs.db.execute<{ n: string }>(sql`
        SELECT count(*) AS n FROM listings WHERE status = 'active' AND deleted_at IS NULL AND published_at > ${since.toISOString()}::timestamptz
          ${query.businessType ? sql`AND business_types @> ARRAY[${query.businessType}]::text[]` : sql``}
          ${query.dealType ? sql`AND deal_type = ${query.dealType}` : sql``}`),
    ]);
    return {
      id: r.id,
      name: r.name,
      query,
      channels: r.channels as AlertChannel[],
      active: r.active,
      lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      matchCount: all.total,
      newCount: Math.min(Number(fresh[0]?.n ?? 0), all.total),
    };
  }

  private async own(user: AuthUser, id: string) {
    const r = await this.dbs.db.query.savedSearches.findFirst({ where: and(eq(savedSearches.id, id), isNull(savedSearches.deletedAt)) });
    if (!r || r.userId !== user.id) throw problems.notFound('შენახული ძებნა');
    return r;
  }

  async list(user: AuthUser) {
    const rows = await this.dbs.db.query.savedSearches.findMany({ where: and(eq(savedSearches.userId, user.id), isNull(savedSearches.deletedAt)), orderBy: desc(savedSearches.createdAt) });
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  async create(user: AuthUser, input: { name: string; query: SearchFilters; channels: AlertChannel[] }) {
    const count = await this.dbs.db.$count(savedSearches, and(eq(savedSearches.userId, user.id), isNull(savedSearches.deletedAt)));
    if (count >= 50) throw problems.conflict('შენახული ძებნების ლიმიტი — 50');
    const query = this.clean(input.query);
    const [row] = await this.dbs.db
      .insert(savedSearches)
      .values({ userId: user.id, name: input.name || describeFilters(query), query: query as Record<string, unknown>, channels: input.channels, unsubscribeToken: randomBytes(24).toString('base64url'), lastNotifiedAt: new Date() })
      .returning();
    return this.toDto(row!);
  }

  async update(user: AuthUser, id: string, patch: { name?: string; channels?: AlertChannel[]; active?: boolean }) {
    await this.own(user, id);
    const [row] = await this.dbs.db.update(savedSearches).set(patch).where(eq(savedSearches.id, id)).returning();
    return this.toDto(row!);
  }

  async remove(user: AuthUser, id: string) {
    await this.own(user, id);
    await this.dbs.db.update(savedSearches).set({ deletedAt: new Date(), active: false }).where(eq(savedSearches.id, id));
    return { ok: true };
  }

  async byToken(token: string) {
    const r = await this.dbs.db.query.savedSearches.findFirst({ where: and(eq(savedSearches.unsubscribeToken, token), isNull(savedSearches.deletedAt)) });
    if (!r) throw problems.notFound('გამოწერა');
    return { name: r.name, active: r.active };
  }

  async unsubscribe(token: string) {
    const r = await this.dbs.db.query.savedSearches.findFirst({ where: and(eq(savedSearches.unsubscribeToken, token), isNull(savedSearches.deletedAt)) });
    if (!r) throw problems.notFound('გამოწერა');
    await this.dbs.db.update(savedSearches).set({ active: false }).where(eq(savedSearches.id, r.id));
    return { ok: true, name: r.name };
  }

  /**
   * Job: a listing just went live → replay every active saved search against it (engine.matches) and notify
   * matches through the channels chosen by the user. Runs in the queue right after moderation (< 1 min).
   */
  async onPublished(listingId: string) {
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    if (!l || l.status !== 'active' || l.deletedAt) return { notified: 0 };
    // cheap SQL prefilter on the most selective keys; the engine does the exact replay
    const candidates = await this.dbs.db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.active, true),
          isNull(savedSearches.deletedAt),
          sql`${savedSearches.userId} <> ${l.ownerId}`,
          sql`(${savedSearches.query}->>'businessType' IS NULL OR ${savedSearches.query}->>'businessType' = ANY(${`{${l.businessTypes.join(',')}}`}::text[]))`,
          sql`(${savedSearches.query}->>'dealType' IS NULL OR ${savedSearches.query}->>'dealType' = ${l.dealType})`,
        ),
      );
    let notified = 0;
    for (const s of candidates) {
      const q = this.normalize(s.query);
      let ok = false;
      try {
        ok = await this.search.engine.matches(l.id, { ...q, limit: 1 } as SearchQuery);
      } catch (e) {
        this.logger.warn(`saved search ${s.id} replay failed: ${(e as Error).message}`);
      }
      if (!ok) continue;
      await this.notify.notify({
        userId: s.userId,
        template: 'listing_alert',
        category: 'listing',
        channels: s.channels as Channel[],
        vars: { search: s.name, title: l.title, price: formatMoney(l.priceMinor, l.currency), unsubscribe: `${this.env.APP_URL}/alerts/unsubscribe/${s.unsubscribeToken}` },
        link: `/listings/${l.slug}`,
      });
      await this.dbs.db.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, s.id));
      notified++;
    }
    return { notified };
  }
}
