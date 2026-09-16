import { Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from '@lokacia/db';
import { POI_CATEGORIES, POI_LABELS_KA, priceDelta, type PoiCategory } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { QueueService } from '../../common/queue.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

export type Insights = {
  radiusM: number;
  categories: { category: PoiCategory; label: string; count: number; nearest: { name: string; distanceM: number; lat: number; lng: number }[] }[];
  price: ReturnType<typeof priceDelta> & { districtName: string | null } | null;
  district: { id: string; name: string; slug: string } | null;
};

@Injectable()
export class GeoService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly tax: TaxonomyService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register('geo.district-stats', () => this.recomputeDistrictStats());
    this.queue.every('geo.district-stats', 6 * 3600_000);
  }

  /** P3: competitors (same business type), transport, schools, business centers within radius + price delta. */
  async insights(input: { lat: number; lng: number; businessType?: string; radiusM?: number; priceMinor?: number; areaM2?: number; dealType?: string }): Promise<Insights> {
    const radius = input.radiusM ?? 500;
    const point = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`;
    const rows = await this.dbs.db.execute<{ category: PoiCategory; name: string; lat: number; lng: number; distance: number; rn: number; cnt: number }>(sql`
      WITH near AS (
        SELECT category, name, lat, lng, ST_Distance(geom, ${point}) AS distance
        FROM pois
        WHERE deleted_at IS NULL AND ST_DWithin(geom, ${point}, ${radius})
          AND (category <> 'competitor' OR ${input.businessType ?? null}::text IS NULL OR business_type = ${input.businessType ?? null})
      )
      SELECT *, row_number() OVER (PARTITION BY category ORDER BY distance) AS rn, count(*) OVER (PARTITION BY category) AS cnt FROM near`);
    const categories = POI_CATEGORIES.map((category) => {
      const inCat = rows.filter((r) => r.category === category);
      return {
        category,
        label: POI_LABELS_KA[category],
        count: inCat[0] ? Number(inCat[0].cnt) : 0,
        nearest: inCat.filter((r) => Number(r.rn) <= 3).map((r) => ({ name: r.name, distanceM: Math.round(r.distance), lat: r.lat, lng: r.lng })),
      };
    });
    const districtId = await this.tax.districtAt(input.lat, input.lng);
    const d = await this.tax.districtById(districtId);
    let price: Insights['price'] = null;
    if (d && input.priceMinor && input.areaM2 && (!input.dealType || input.dealType === 'rent' || input.dealType === 'short_term')) {
      const avg = await this.avgPriceM2(d.id, input.businessType);
      const delta = priceDelta(input.priceMinor, input.areaM2, avg);
      price = delta ? { ...delta, districtName: d.nameKa } : null;
    }
    return { radiusM: radius, categories, price, district: d ? { id: d.id, name: d.nameKa, slug: d.slug } : null };
  }

  /** Average monthly rent per m² (tetri) in a district, optionally for a business type; falls back to district avg. */
  async avgPriceM2(districtId: string, businessType?: string) {
    const rows = await this.dbs.db.execute<{ avg: string | null; n: string }>(sql`
      SELECT avg(price_minor / NULLIF(area_m2, 0)) AS avg, count(*) AS n FROM listings
      WHERE district_id = ${districtId} AND deal_type = 'rent' AND status IN ('active', 'stale', 'rented') AND deleted_at IS NULL
        ${businessType ? sql`AND business_types @> ARRAY[${businessType}]::text[]` : sql``}`);
    const r = rows[0];
    if (r && Number(r.n) >= 3 && r.avg) return Math.round(Number(r.avg));
    return (await this.tax.districtById(districtId))?.avgPriceM2Minor ?? null;
  }

  /** P18: price recommendation for the wizard/edit/stats. */
  async priceCheck(input: { districtId?: string | null; lat?: number; lng?: number; areaM2: number; priceMinor: number; businessType?: string; dealType?: string }) {
    const districtId = input.districtId ?? (input.lat != null && input.lng != null ? await this.tax.districtAt(input.lat, input.lng) : null);
    if (!districtId || input.dealType === 'sale' || input.dealType === 'transfer') return null;
    const avg = await this.avgPriceM2(districtId, input.businessType);
    const d = await this.tax.districtById(districtId);
    const delta = priceDelta(input.priceMinor, input.areaM2, avg);
    if (!delta) return null;
    const messageKa =
      delta.verdict === 'above'
        ? `თქვენი ფასი ${delta.deltaPct}%-ით მაღლია ${d?.nameKa ?? 'რაიონის'} საშუალოზე`
        : delta.verdict === 'below'
          ? `თქვენი ფასი ${Math.abs(delta.deltaPct)}%-ით დაბლია ${d?.nameKa ?? 'რაიონის'} საშუალოზე`
          : `ფასი შეესაბამება ${d?.nameKa ?? 'რაიონის'} საშუალოს`;
    return { ...delta, districtName: d?.nameKa ?? null, messageKa };
  }

  /** P23 free part: live per-district stats, optionally filtered. */
  async districtStats(q: { city?: string; businessType?: string; dealType?: string }) {
    const rows = await this.dbs.db.execute<{ id: string; slug: string; name_ka: string; center_lat: number; center_lng: number; avg_m2: string | null; active: string; vacancy: string; median_area: string | null; avg_daily_traffic: string | null }>(sql`
      SELECT d.id, d.slug, d.name_ka, d.center_lat, d.center_lng,
        avg(l.price_minor / NULLIF(l.area_m2, 0)) FILTER (WHERE l.deal_type = ${q.dealType ?? 'rent'}) AS avg_m2,
        count(l.id) FILTER (WHERE l.status = 'active') AS active,
        count(l.id) FILTER (WHERE l.status IN ('active', 'stale') AND l.deal_type IN ('rent', 'short_term')) AS vacancy,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area_m2) AS median_area,
        (SELECT round(sum(ts.count)::numeric / 7 / NULLIF(count(DISTINCT ts.listing_id), 0))
           FROM traffic_samples ts JOIN listings tl ON tl.id = ts.listing_id
          WHERE tl.district_id = d.id AND ts.deleted_at IS NULL) AS avg_daily_traffic
      FROM districts d
      LEFT JOIN listings l ON l.district_id = d.id AND l.deleted_at IS NULL AND l.status IN ('active', 'stale', 'rented')
        ${q.businessType ? sql`AND l.business_types @> ARRAY[${q.businessType}]::text[]` : sql``}
      WHERE d.city = ${q.city ?? 'tbilisi'}
      GROUP BY d.id ORDER BY d.name_ka`);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name_ka,
      center: [r.center_lng, r.center_lat] as [number, number],
      avgPriceM2Minor: r.avg_m2 ? Math.round(Number(r.avg_m2)) : null,
      activeCount: Number(r.active),
      vacancyCount: Number(r.vacancy),
      medianAreaM2: r.median_area ? Math.round(Number(r.median_area)) : null,
      avgDailyTraffic: r.avg_daily_traffic ? Number(r.avg_daily_traffic) : null,
    }));
  }

  async recomputeDistrictStats() {
    await this.dbs.db.execute(sql`
      UPDATE districts d SET
        avg_price_m2_minor = COALESCE(d.avg_price_m2_override_minor, sub.avg_rent, d.avg_price_m2_minor),
        avg_sale_price_m2_minor = COALESCE(sub.avg_sale, d.avg_sale_price_m2_minor),
        active_count = COALESCE(sub.active, 0),
        vacancy_count = COALESCE(sub.vacancy, 0),
        updated_at = now()
      FROM (
        SELECT district_id,
          round(avg(price_minor / NULLIF(area_m2, 0)) FILTER (WHERE deal_type = 'rent'))::int AS avg_rent,
          round(avg(price_minor / NULLIF(area_m2, 0)) FILTER (WHERE deal_type = 'sale'))::int AS avg_sale,
          count(*) FILTER (WHERE status = 'active')::int AS active,
          count(*) FILTER (WHERE status IN ('active', 'stale') AND deal_type IN ('rent', 'short_term'))::int AS vacancy
        FROM listings WHERE deleted_at IS NULL GROUP BY district_id
      ) sub WHERE sub.district_id = d.id`);
    this.tax.invalidate();
  }
}
