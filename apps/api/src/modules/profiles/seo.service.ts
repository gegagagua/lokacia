import { Injectable } from '@nestjs/common';
import { sql, type SQL } from '@lokacia/db';
import type { DealType, LandingDto, SiteStatsDto, SitemapListingDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { RedisService } from '../../common/redis.service';
import { ListingReadService } from '../listings/listing-read.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

/** Data for SEO landing pages, sitemaps and live trust stats (Phase 14). */
@Injectable()
export class SeoService {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly tax: TaxonomyService,
    private readonly redis: RedisService,
  ) {}

  private async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(`seo:${key}`);
    if (hit) return JSON.parse(hit) as T;
    const v = await fn();
    await this.redis.set(`seo:${key}`, JSON.stringify(v), ttl);
    return v;
  }

  /** Landing for a business type, a district, or both. Returns null when a slug is unknown. */
  async landing(q: { businessType?: string; district?: string; city?: string }): Promise<LandingDto | null> {
    const bt = q.businessType ? await this.tax.businessType(q.businessType) : null;
    if (q.businessType && !bt) return null;
    const d = q.district ? await this.tax.districtBySlug(q.district, q.city) : null;
    if (q.district && !d) return null;
    return this.cached(`landing:${q.businessType ?? ''}:${q.district ?? ''}`, 300, async () => {
      const where: SQL[] = [sql`l.deleted_at IS NULL`, sql`l.status = 'active'`];
      if (bt) where.push(sql`l.business_types @> ARRAY[${bt.slug}]::text[]`);
      if (d) where.push(sql`l.district_id = ${d.id}`);
      const w = sql.join(where, sql` AND `);
      const [agg] = await this.dbs.db.execute<{ total: string; avg_m2: string | null; min_price: string | null; median_area: string | null; owners: string }>(sql`
        SELECT count(*) AS total,
          avg(l.price_minor / NULLIF(l.area_m2, 0)) FILTER (WHERE l.deal_type = 'rent') AS avg_m2,
          min(l.price_minor) FILTER (WHERE l.deal_type = 'rent') AS min_price,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area_m2) AS median_area,
          count(*) FILTER (WHERE l.is_owner) AS owners
        FROM listings l WHERE ${w}`);
      const byDeal = await this.dbs.db.execute<{ deal_type: DealType; n: string }>(sql`SELECT l.deal_type, count(*) AS n FROM listings l WHERE ${w} GROUP BY 1`);
      const top = await this.dbs.db.execute<{ id: string }>(sql`
        SELECT l.id FROM listings l WHERE ${w}
        ORDER BY (l.vip_until IS NOT NULL AND l.vip_until > now()) DESC, l.verified_owner DESC, l.last_confirmed_at DESC NULLS LAST LIMIT 12`);
      let related: LandingDto['related'] = [];
      if (bt && !d) {
        const rows = await this.dbs.db.execute<{ district_id: string; n: string }>(sql`
          SELECT l.district_id, count(*) AS n FROM listings l WHERE ${w} AND l.district_id IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 30`);
        related = (await Promise.all(rows.map(async (r) => ({ d: await this.tax.districtById(r.district_id), n: Number(r.n) }))))
          .filter((x) => !!x.d)
          .map((x) => ({ kind: 'district' as const, slug: x.d!.slug, name: x.d!.nameKa, count: x.n }));
      } else {
        const rows = await this.dbs.db.execute<{ bt: string; n: string }>(sql`
          SELECT unnest(l.business_types) AS bt, count(*) AS n FROM listings l WHERE ${w} GROUP BY 1 ORDER BY n DESC`);
        const types = await this.tax.businessTypes();
        related = rows
          .map((r) => ({ t: types.find((t) => t.slug === r.bt), n: Number(r.n) }))
          .filter((x) => !!x.t && x.t.slug !== bt?.slug)
          .map((x) => ({ kind: 'businessType' as const, slug: x.t!.slug, name: x.t!.nameKa, count: x.n }));
      }
      const total = Number(agg?.total ?? 0);
      return {
        businessType: bt ? { slug: bt.slug, name: bt.nameKa } : null,
        district: d ? { slug: d.slug, name: d.nameKa, city: d.city } : null,
        total,
        byDealType: Object.fromEntries(byDeal.map((r) => [r.deal_type, Number(r.n)])),
        avgPriceM2Minor: agg?.avg_m2 ? Math.round(Number(agg.avg_m2)) : null,
        minPriceMinor: agg?.min_price ? Number(agg.min_price) : null,
        medianAreaM2: agg?.median_area ? Math.round(Number(agg.median_area)) : null,
        ownersShare: total ? Math.round((Number(agg?.owners ?? 0) / total) * 100) : 0,
        listings: await this.read.cards(top.map((r) => r.id)),
        related,
      };
    });
  }

  /** (businessType, district) pairs with active listings — landing combos for sitemap & internal links. */
  async combos(min = 1) {
    return this.cached(`combos:${min}`, 900, async () => {
      const rows = await this.dbs.db.execute<{ bt: string; district_id: string; n: string }>(sql`
        SELECT unnest(business_types) AS bt, district_id, count(*) AS n FROM listings
        WHERE deleted_at IS NULL AND status = 'active' AND district_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) >= ${min}`);
      const out: { businessType: string; district: string; city: string; count: number }[] = [];
      for (const r of rows) {
        const d = await this.tax.districtById(r.district_id);
        if (d) out.push({ businessType: r.bt, district: d.slug, city: d.city, count: Number(r.n) });
      }
      return out.sort((a, b) => b.count - a.count);
    });
  }

  async stats(): Promise<SiteStatsDto> {
    return this.cached('stats', 120, async () => {
      const [r] = await this.dbs.db.execute<Record<string, string>>(sql`
        SELECT
          (SELECT count(*) FROM listings WHERE deleted_at IS NULL AND status = 'active') AS active_listings,
          (SELECT count(*) FROM listings WHERE deleted_at IS NULL AND status = 'active' AND last_confirmed_at > now() - interval '14 days') AS confirmed_14d,
          (SELECT count(*) FROM listings WHERE deleted_at IS NULL AND status = 'active' AND verified_owner) AS verified_owners,
          (SELECT count(*) FROM users WHERE deleted_at IS NULL AND role IN ('broker', 'agency_manager')) AS brokers,
          (SELECT count(*) FROM organizations WHERE deleted_at IS NULL AND type = 'agency') AS agencies,
          (SELECT count(*) FROM demand_requests WHERE deleted_at IS NULL AND status = 'active' AND expires_at > now()) AS active_demand,
          (SELECT count(*) FROM service_providers WHERE deleted_at IS NULL) AS providers,
          (SELECT count(*) FROM projects WHERE deleted_at IS NULL) AS projects,
          (SELECT count(*) FROM listings WHERE deleted_at IS NULL AND status = 'active' AND published_at > now() - interval '7 days') AS new_week`);
      return {
        activeListings: Number(r?.active_listings ?? 0),
        confirmedLast14d: Number(r?.confirmed_14d ?? 0),
        verifiedOwners: Number(r?.verified_owners ?? 0),
        brokers: Number(r?.brokers ?? 0),
        agencies: Number(r?.agencies ?? 0),
        activeDemand: Number(r?.active_demand ?? 0),
        providers: Number(r?.providers ?? 0),
        projects: Number(r?.projects ?? 0),
        newThisWeek: Number(r?.new_week ?? 0),
      };
    });
  }

  async sitemapListings(page: number, size: number): Promise<{ items: SitemapListingDto[]; total: number }> {
    const rows = await this.dbs.db.execute<{ slug: string; updated_at: string; total: string }>(sql`
      SELECT slug, updated_at, count(*) OVER() AS total FROM listings
      WHERE deleted_at IS NULL AND status IN ('active', 'stale') ORDER BY published_at NULLS LAST, id LIMIT ${size} OFFSET ${page * size}`);
    let total = rows[0] ? Number(rows[0].total) : 0;
    if (!rows.length) {
      const [c] = await this.dbs.db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM listings WHERE deleted_at IS NULL AND status IN ('active', 'stale')`);
      total = Number(c?.n ?? 0);
    }
    return { items: rows.map((r) => ({ slug: r.slug, updatedAt: new Date(r.updated_at).toISOString() })), total };
  }
}
