import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, listings, locationScores, spacePassports, sql, trafficSamples } from '@lokacia/db';
import { priceDelta, type ScoreComponent, type ScoreResponse, type TrafficResponse } from '@lokacia/contracts';
import { summarizeScore, type AiClient } from '@lokacia/ai';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { RateLimitService } from '../../../common/redis.service';
import { AI } from '../../../integrations/integrations.module';
import { TRAFFIC, type TrafficProvider } from '../../../integrations/traffic/traffic';
import { GeoService } from '../../geo/geo.service';
import { ListingReadService, PUBLIC_STATUSES } from '../../listings/listing-read.service';
import { SearchService } from '../../search/search.service';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';

type ListingRow = typeof listings.$inferSelect;

const LABELS: Record<string, string> = {
  traffic: 'ფეხით მოსიარულეთა ნაკადი',
  competition: 'კონკურენცია (ნაკლები — უკეთესი)',
  price: 'ფასი რაიონის საშუალოსთან',
  transport: 'ტრანსპორტის ხელმისაწვდომობა',
  passport: 'ტექნიკური შესაბამისობა',
};
const WEIGHTS: Record<string, number> = { traffic: 0.35, competition: 0.2, price: 0.2, transport: 0.15, passport: 0.1 };
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** V1 foot traffic (samples → provider fallback) and V2 explainable location score. */
@Injectable()
export class InsightsService implements OnModuleInit {
  private readonly logger = new Logger('Insights');
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly tax: TaxonomyService,
    private readonly geo: GeoService,
    private readonly search: SearchService,
    private readonly queue: QueueService,
    @Inject(TRAFFIC) private readonly traffic: TrafficProvider,
    @Inject(AI) private readonly ai: AiClient,
    private readonly rate: RateLimitService,
  ) {}

  onModuleInit() {
    this.queue.register('v2.scores.recompute', (d: { listingId?: string; limit?: number }) => (d?.listingId ? this.recompute(d.listingId) : this.recomputeAll(d?.limit)));
    this.queue.every('v2.scores.recompute', 24 * 3600_000, { limit: 5000 });
  }

  async listing(idOrSlug: string) {
    const l = await this.read.findRaw(idOrSlug);
    if (!l) throw problems.notFound('განცხადება');
    return l;
  }

  /* ---------------- traffic ---------------- */

  async samples(l: ListingRow): Promise<{ source: 'samples' | 'provider'; provider: string; rows: { weekday: number; hour: number; count: number }[] }> {
    const rows = await this.dbs.db
      .select({ weekday: trafficSamples.weekday, hour: trafficSamples.hour, count: trafficSamples.count, provider: trafficSamples.provider })
      .from(trafficSamples)
      .where(and(eq(trafficSamples.listingId, l.id), isNull(trafficSamples.deletedAt)))
      .orderBy(asc(trafficSamples.weekday), asc(trafficSamples.hour));
    if (rows.length >= 24) return { source: 'samples', provider: rows[0]!.provider, rows };
    if (l.lat == null || l.lng == null) return { source: 'provider', provider: this.traffic.name, rows: [] };
    const fresh = await this.traffic.hourly(l.lat, l.lng);
    // ingest (V1): keep provider data so later reads and reports use the same dataset
    if (fresh.length) {
      await this.dbs.db.delete(trafficSamples).where(eq(trafficSamples.listingId, l.id));
      for (let i = 0; i < fresh.length; i += 500) {
        await this.dbs.db.insert(trafficSamples).values(fresh.slice(i, i + 500).map((s) => ({ ...s, listingId: l.id, districtId: l.districtId, provider: this.traffic.name, lat: l.lat, lng: l.lng })));
      }
    }
    return { source: 'provider', provider: this.traffic.name, rows: fresh };
  }

  async trafficFor(idOrSlug: string, client?: { canManage?: boolean }): Promise<TrafficResponse> {
    const l = await this.listing(idOrSlug);
    if (!(PUBLIC_STATUSES as readonly string[]).includes(l.status) && !client?.canManage) throw problems.notFound('განცხადება');
    const { source, provider, rows } = await this.samples(l);
    const days = Array.from({ length: 7 }, (_, weekday) => {
      const hours = Array.from({ length: 24 }, (_, h) => rows.find((r) => r.weekday === weekday && r.hour === h)?.count ?? 0);
      return { weekday, hours, total: hours.reduce((a, b) => a + b, 0) };
    });
    let peak = { weekday: 1, hour: 12, count: 0 };
    for (const r of rows) if (r.count > peak.count) peak = { weekday: r.weekday, hour: r.hour, count: r.count };
    const avgDailyTotal = Math.round(days.reduce((a, d) => a + d.total, 0) / 7);
    return { listingId: l.id, source, provider, days, peak, avgDailyTotal };
  }

  /* ---------------- score ---------------- */

  async compute(l: ListingRow, businessType: string): Promise<{ score: number; components: ScoreComponent[] }> {
    const { rows } = await this.samples(l);
    const daily = rows.length ? rows.reduce((a, r) => a + r.count, 0) / 7 : 0;
    const trafficValue = clamp((daily / 12_000) * 100);

    let competitors = 0;
    let transport = 0;
    if (l.lat != null && l.lng != null) {
      const point = sql`ST_SetSRID(ST_MakePoint(${l.lng}, ${l.lat}), 4326)::geography`;
      const counts = await this.dbs.db.execute<{ competitors: string; transport: string }>(sql`
        SELECT count(*) FILTER (WHERE category = 'competitor' AND business_type = ${businessType}) AS competitors,
               count(*) FILTER (WHERE category = 'transport') AS transport
        FROM pois WHERE deleted_at IS NULL AND ST_DWithin(geom, ${point}, 500)`);
      competitors = Number(counts[0]?.competitors ?? 0);
      transport = Number(counts[0]?.transport ?? 0);
    }
    const competitionValue = clamp(100 - competitors * 12);
    const transportValue = clamp(30 + transport * 14);

    let priceValue = 60;
    if (l.districtId && (l.dealType === 'rent' || l.dealType === 'short_term')) {
      const avg = await this.geo.avgPriceM2(l.districtId, businessType);
      const delta = priceDelta(l.priceMinor, l.areaM2, avg);
      if (delta) priceValue = clamp(70 - delta.deltaPct);
    }

    const bt = await this.tax.businessType(businessType);
    const required = (bt?.filterConfig?.required ?? []) as string[];
    let passportValue = 70;
    if (required.length) {
      const p = await this.dbs.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, l.id) });
      const record = (p ?? {}) as Record<string, unknown>;
      const ok = required.filter((k) => record[k] !== null && record[k] !== undefined && record[k] !== false).length;
      passportValue = clamp((ok / required.length) * 100);
    }
    const values: Record<string, number> = { traffic: trafficValue, competition: competitionValue, price: priceValue, transport: transportValue, passport: passportValue };
    const components = Object.keys(WEIGHTS).map((key) => ({ key, label: LABELS[key]!, value: values[key]!, weight: WEIGHTS[key]! }));
    const score = clamp(components.reduce((a, c) => a + c.value * c.weight, 0));
    return { score, components };
  }

  private toDto(row: typeof locationScores.$inferSelect): ScoreResponse {
    return { listingId: row.listingId, businessType: row.businessType, score: row.score, components: row.components, summary: row.summary ?? '', computedAt: row.computedAt.toISOString() };
  }

  async upsertScore(l: ListingRow, businessType: string, withAi: boolean) {
    const { score, components } = await this.compute(l, businessType);
    const btName = (await this.tax.businessType(businessType))?.nameKa ?? businessType;
    const summary = withAi
      ? await summarizeScore(this.ai, { score, businessType: btName, components })
      : await summarizeScore({ ...this.ai, live: false } as AiClient, { score, businessType: btName, components });
    const [row] = await this.dbs.db
      .insert(locationScores)
      .values({ listingId: l.id, businessType, score, components, summary, computedAt: new Date() })
      .onConflictDoUpdate({ target: [locationScores.listingId, locationScores.businessType], set: { score, components, summary, computedAt: new Date(), updatedAt: new Date() } })
      .returning();
    if (businessType === l.businessTypes[0] && l.locationScore !== score) {
      await this.dbs.db.update(listings).set({ locationScore: score }).where(eq(listings.id, l.id));
      await this.search.listingChanged(l.id);
    }
    return row!;
  }

  /**
   * Public score. Computing a new score costs an AI call + traffic provider call + a stored row, so the business type
   * must be a real taxonomy slug, the listing must be public, and fresh computations are rate-limited per client.
   */
  async scoreFor(idOrSlug: string, businessType?: string, client?: { ip?: string; canManage?: boolean }): Promise<ScoreResponse> {
    const l = await this.listing(idOrSlug);
    if (!(PUBLIC_STATUSES as readonly string[]).includes(l.status) && !client?.canManage) throw problems.notFound('განცხადება');
    const bt = businessType ?? l.businessTypes[0];
    if (!bt) throw problems.badRequest('ბიზნესის ტიპი არ არის მითითებული');
    if (bt.length > 40 || (!l.businessTypes.includes(bt) && !(await this.tax.businessType(bt)))) throw problems.badRequest('ბიზნესის ტიპი არ მოიძებნა');
    const existing = await this.dbs.db.query.locationScores.findFirst({ where: and(eq(locationScores.listingId, l.id), eq(locationScores.businessType, bt)) });
    if (existing) return this.toDto(existing);
    if (client?.ip) await this.rate.hit(`score:compute:${client.ip}`, 30, 3600);
    return this.toDto(await this.upsertScore(l, bt, true));
  }

  async recompute(idOrSlug: string, businessType?: string) {
    const l = await this.listing(idOrSlug);
    const bt = businessType ?? l.businessTypes[0];
    if (!bt) throw problems.badRequest('ბიზნესის ტიპი არ არის მითითებული');
    return this.toDto(await this.upsertScore(l, bt, true));
  }

  /** Nightly job: deterministic (rule summary) scores for all active listings. */
  async recomputeAll(limit = 5000) {
    const rows = await this.dbs.db.select().from(listings).where(and(eq(listings.status, 'active'), isNull(listings.deletedAt))).limit(limit);
    let n = 0;
    for (const l of rows) {
      const bt = l.businessTypes[0];
      if (!bt) continue;
      try {
        await this.upsertScore(l, bt, false);
        n++;
      } catch (e) {
        this.logger.warn(`score ${l.id} failed: ${(e as Error).message}`);
      }
    }
    return { recomputed: n };
  }
}
