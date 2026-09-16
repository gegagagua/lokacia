import { Logger } from '@nestjs/common';
import { sql, type Db, type SQL } from '@lokacia/db';
import { PASSPORT_FIELD_BY_KEY, PASSPORT_KEYS, decodeCursor, encodeCursor, type SearchQuery } from '@lokacia/contracts';

export type SearchResult = { ids: string[]; total: number; nextCursor: string | null; tookMs: number };
export type MapPoint = { id: string; slug: string; lat: number; lng: number; priceMinor: number; areaM2: number; dealType: string; vip: boolean; title: string; businessType: string | null };

export interface SearchEngine {
  readonly name: 'postgres' | 'meilisearch';
  search(q: SearchQuery, opts?: { statuses?: string[] }): Promise<SearchResult>;
  mapPoints(q: SearchQuery, limit?: number): Promise<MapPoint[]>;
  index(listingId: string): Promise<void>;
  remove(listingId: string): Promise<void>;
  /** Replays a saved-search query against one listing (alerts, P7). */
  matches(listingId: string, q: SearchQuery): Promise<boolean>;
}

const COLUMN: Record<string, string> = {
  powerKw: 'power_kw', threePhase: 'three_phase', ceilingM: 'ceiling_m', facadeM: 'facade_m', widthM: 'width_m', depthM: 'depth_m',
  hasHood: 'has_hood', hasGas: 'has_gas', wetPoints: 'wet_points', gateWM: 'gate_w_m', truckAccess: 'truck_access', access247: 'access_24_7',
  parking: 'parking', shopWindow: 'shop_window', separateEntrance: 'separate_entrance', ventilation: 'ventilation',
};

/** PostGIS + pg_trgm implementation. All filters in one indexed query. */
export class PostgresSearchEngine implements SearchEngine {
  readonly name = 'postgres' as const;
  constructor(private readonly db: Db) {}

  where(q: SearchQuery, statuses: string[] = ['active']): SQL {
    const c: SQL[] = [sql`l.deleted_at IS NULL`, sql`l.status = ANY(${`{${statuses.join(',')}}`}::text[])`];
    if (q.businessType) c.push(sql`l.business_types @> ARRAY[${q.businessType}]::text[]`);
    if (q.dealType) c.push(sql`l.deal_type = ${q.dealType}`);
    if (q.city) c.push(sql`l.city = ${q.city}`);
    if (q.districts?.length) c.push(sql`l.district_id IN (SELECT id FROM districts WHERE slug = ANY(${`{${q.districts.join(',')}}`}::text[]) ${q.city ? sql`AND city = ${q.city}` : sql``})`);
    if (q.priceMin != null) c.push(sql`l.price_minor >= ${Math.round(q.priceMin * 100)}`);
    if (q.priceMax != null) c.push(sql`l.price_minor <= ${Math.round(q.priceMax * 100)}`);
    if (q.areaMin != null) c.push(sql`l.area_m2 >= ${q.areaMin}`);
    if (q.areaMax != null) c.push(sql`l.area_m2 <= ${q.areaMax}`);
    if (q.onlyOwners) c.push(sql`l.is_owner = true`);
    if (q.verifiedOnly) c.push(sql`l.verified_owner = true`);
    if (q.offPlan) c.push(sql`l.project_id IS NOT NULL`);
    if (q.hasVideo) c.push(sql`(l.video_url IS NOT NULL OR l.tour_url IS NOT NULL)`);
    if (q.scoreMin != null) c.push(sql`l.location_score >= ${q.scoreMin}`);
    if (q.lat != null && q.lng != null) c.push(sql`ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography, ${q.radiusM ?? 1000})`);
    if (q.bbox) {
      const [w, s, e, n] = q.bbox;
      c.push(sql`l.geom && ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)::geography`);
    }
    for (const key of PASSPORT_KEYS) {
      const v = q[key];
      if (v === undefined || v === null || v === false) continue;
      const col = sql.raw(`sp.${COLUMN[key]}`);
      if (PASSPORT_FIELD_BY_KEY[key].kind === 'boolean') c.push(sql`${col} = true`);
      else if (typeof v === 'number' && v > 0) c.push(sql`${col} >= ${v}`);
    }
    if (q.q) {
      const like = `%${q.q.replace(/[%_]/g, '')}%`;
      c.push(sql`(l.title ILIKE ${like} OR l.address ILIKE ${like} OR l.description ILIKE ${like} OR similarity(l.title, ${q.q}) > 0.2)`);
    }
    return sql.join(c, sql` AND `);
  }

  private order(q: SearchQuery): SQL {
    const vip = sql`(l.vip_until IS NOT NULL AND l.vip_until > now()) DESC`;
    switch (q.sort) {
      case 'price_asc':
        return sql`${vip}, l.price_minor ASC, l.id`;
      case 'price_desc':
        return sql`${vip}, l.price_minor DESC, l.id`;
      case 'area_desc':
        return sql`${vip}, l.area_m2 DESC, l.id`;
      case 'price_m2_asc':
        return sql`${vip}, (l.price_minor / NULLIF(l.area_m2, 0)) ASC, l.id`;
      case 'score_desc':
        return sql`${vip}, l.location_score DESC NULLS LAST, l.id`;
      case 'relevance':
        if (q.q) return sql`${vip}, similarity(l.title, ${q.q}) DESC, l.published_at DESC NULLS LAST, l.id`;
        return sql`${vip}, l.published_at DESC NULLS LAST, l.id`;
      default:
        return sql`${vip}, l.published_at DESC NULLS LAST, l.id`;
    }
  }

  async search(q: SearchQuery, opts: { statuses?: string[] } = {}): Promise<SearchResult> {
    const started = Date.now();
    const offset = decodeCursor<{ o: number }>(q.cursor)?.o ?? 0;
    const limit = q.limit ?? 24;
    const rows = await this.db.execute<{ id: string; total: string }>(sql`
      SELECT l.id, count(*) OVER() AS total
      FROM listings l LEFT JOIN space_passports sp ON sp.listing_id = l.id
      WHERE ${this.where(q, opts.statuses)}
      ORDER BY ${this.order(q)}
      LIMIT ${limit} OFFSET ${offset}`);
    const total = rows[0] ? Number(rows[0].total) : 0;
    return {
      ids: rows.map((r) => r.id),
      total,
      nextCursor: offset + rows.length < total ? encodeCursor({ o: offset + rows.length }) : null,
      tookMs: Date.now() - started,
    };
  }

  async mapPoints(q: SearchQuery, limit = 2000): Promise<MapPoint[]> {
    const rows = await this.db.execute<{ id: string; slug: string; lat: number; lng: number; price_minor: number; area_m2: string; deal_type: string; vip: boolean; title: string; bt: string | null }>(sql`
      SELECT l.id, l.slug, l.lat, l.lng, l.price_minor, l.area_m2, l.deal_type, (l.vip_until > now()) AS vip, l.title, l.business_types[1] AS bt
      FROM listings l LEFT JOIN space_passports sp ON sp.listing_id = l.id
      WHERE ${this.where(q)} AND l.lat IS NOT NULL
      ORDER BY ${this.order(q)}
      LIMIT ${limit}`);
    return rows.map((r) => ({ id: r.id, slug: r.slug, lat: r.lat, lng: r.lng, priceMinor: r.price_minor, areaM2: Number(r.area_m2), dealType: r.deal_type, vip: !!r.vip, title: r.title, businessType: r.bt }));
  }

  async index() {
    /* data is queried live */
  }
  async remove() {
    /* data is queried live */
  }

  async matches(listingId: string, q: SearchQuery) {
    const rows = await this.db.execute<{ id: string }>(sql`
      SELECT l.id FROM listings l LEFT JOIN space_passports sp ON sp.listing_id = l.id
      WHERE l.id = ${listingId} AND ${this.where({ ...q, cursor: undefined, limit: 1 })} LIMIT 1`);
    return rows.length > 0;
  }
}

/**
 * Meilisearch implementation (SEARCH_ENGINE=meilisearch). Documents are flattened listings; filters are
 * translated to Meili filter expressions. Geo uses _geoRadius/_geoBoundingBox.
 */
export class MeiliSearchEngine implements SearchEngine {
  readonly name = 'meilisearch' as const;
  private readonly logger = new Logger('Meili');
  private ready = false;
  constructor(
    private readonly db: Db,
    private readonly url: string,
    private readonly key: string,
  ) {}

  private async req(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.url}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}`, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`meili ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  private async ensure() {
    if (this.ready) return;
    await this.req('/indexes', { method: 'POST', body: JSON.stringify({ uid: 'listings', primaryKey: 'id' }) }).catch(() => undefined);
    await this.req('/indexes/listings/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        searchableAttributes: ['title', 'address', 'description'],
        filterableAttributes: ['id', 'status', 'businessTypes', 'dealType', 'city', 'district', 'price', 'area', 'isOwner', 'verifiedOwner', 'offPlan', 'hasVideo', 'score', '_geo', ...PASSPORT_KEYS],
        sortableAttributes: ['price', 'area', 'publishedAt', 'priceM2', 'score', 'vip', '_geo'],
      }),
    });
    this.ready = true;
  }

  private filter(q: SearchQuery) {
    const f: string[] = ['status = "active"'];
    const s = (v: string) => JSON.stringify(v);
    if (q.businessType) f.push(`businessTypes = ${s(q.businessType)}`);
    if (q.dealType) f.push(`dealType = ${s(q.dealType)}`);
    if (q.city) f.push(`city = ${s(q.city)}`);
    if (q.districts?.length) f.push(`district IN [${q.districts.map(s).join(',')}]`);
    if (q.priceMin != null) f.push(`price >= ${q.priceMin * 100}`);
    if (q.priceMax != null) f.push(`price <= ${q.priceMax * 100}`);
    if (q.areaMin != null) f.push(`area >= ${q.areaMin}`);
    if (q.areaMax != null) f.push(`area <= ${q.areaMax}`);
    if (q.onlyOwners) f.push('isOwner = true');
    if (q.verifiedOnly) f.push('verifiedOwner = true');
    if (q.offPlan) f.push('offPlan = true');
    if (q.hasVideo) f.push('hasVideo = true');
    if (q.scoreMin != null) f.push(`score >= ${q.scoreMin}`);
    if (q.lat != null && q.lng != null) f.push(`_geoRadius(${q.lat}, ${q.lng}, ${q.radiusM ?? 1000})`);
    if (q.bbox) f.push(`_geoBoundingBox([${q.bbox[3]}, ${q.bbox[2]}], [${q.bbox[1]}, ${q.bbox[0]}])`);
    for (const key of PASSPORT_KEYS) {
      const v = q[key];
      if (v === undefined || v === null || v === false) continue;
      f.push(PASSPORT_FIELD_BY_KEY[key].kind === 'boolean' ? `${key} = true` : `${key} >= ${v}`);
    }
    return f.join(' AND ');
  }

  private sort(q: SearchQuery) {
    const m: Record<string, string> = { price_asc: 'price:asc', price_desc: 'price:desc', area_desc: 'area:desc', price_m2_asc: 'priceM2:asc', score_desc: 'score:desc', newest: 'publishedAt:desc' };
    return ['vip:desc', ...(q.sort && m[q.sort] ? [m[q.sort]!] : q.q ? [] : ['publishedAt:desc'])];
  }

  async search(q: SearchQuery): Promise<SearchResult> {
    await this.ensure();
    const started = Date.now();
    const offset = decodeCursor<{ o: number }>(q.cursor)?.o ?? 0;
    const r = await this.req('/indexes/listings/search', { method: 'POST', body: JSON.stringify({ q: q.q ?? '', filter: this.filter(q), sort: this.sort(q), limit: q.limit, offset, attributesToRetrieve: ['id'] }) });
    const ids = (r.hits as { id: string }[]).map((h) => h.id);
    const total = r.estimatedTotalHits as number;
    return { ids, total, nextCursor: offset + ids.length < total ? encodeCursor({ o: offset + ids.length }) : null, tookMs: Date.now() - started };
  }

  async mapPoints(q: SearchQuery, limit = 2000): Promise<MapPoint[]> {
    await this.ensure();
    const r = await this.req('/indexes/listings/search', { method: 'POST', body: JSON.stringify({ q: q.q ?? '', filter: this.filter(q), sort: this.sort(q), limit, attributesToRetrieve: ['id', 'slug', '_geo', 'price', 'area', 'dealType', 'vip', 'title', 'businessTypes'] }) });
    return (r.hits as any[]).map((h) => ({ id: h.id, slug: h.slug, lat: h._geo.lat, lng: h._geo.lng, priceMinor: h.price, areaM2: h.area, dealType: h.dealType, vip: !!h.vip, title: h.title, businessType: h.businessTypes?.[0] ?? null })); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  async index(listingId: string) {
    await this.ensure();
    const rows = await this.db.execute<Record<string, any>>(sql`
      SELECT l.*, sp.*, l.id AS lid, d.slug AS district_slug FROM listings l
      LEFT JOIN space_passports sp ON sp.listing_id = l.id LEFT JOIN districts d ON d.id = l.district_id WHERE l.id = ${listingId}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    const l = rows[0];
    if (!l || l.deleted_at || l.status !== 'active') return this.remove(listingId);
    const doc: Record<string, unknown> = {
      id: l.lid, slug: l.slug, title: l.title, address: l.address, description: l.description, status: l.status, businessTypes: l.business_types, dealType: l.deal_type,
      city: l.city, district: l.district_slug, price: l.price_minor, area: Number(l.area_m2), priceM2: l.price_minor / Number(l.area_m2), isOwner: l.is_owner, verifiedOwner: l.verified_owner,
      offPlan: !!l.project_id, hasVideo: !!(l.video_url || l.tour_url), score: l.location_score, vip: l.vip_until ? new Date(l.vip_until) > new Date() : false,
      publishedAt: l.published_at ? new Date(l.published_at).getTime() : 0, _geo: l.lat != null ? { lat: l.lat, lng: l.lng } : null,
    };
    for (const key of PASSPORT_KEYS) doc[key] = l[COLUMN[key]!] ?? null;
    await this.req('/indexes/listings/documents', { method: 'POST', body: JSON.stringify([doc]) });
  }

  async remove(listingId: string) {
    await this.req(`/indexes/listings/documents/${listingId}`, { method: 'DELETE' }).catch((e: Error) => this.logger.warn(e.message));
  }

  async matches(listingId: string, q: SearchQuery) {
    const r = await this.req('/indexes/listings/search', { method: 'POST', body: JSON.stringify({ q: q.q ?? '', filter: `${this.filter(q)} AND id = ${JSON.stringify(listingId)}`, limit: 1 }) });
    return (r.hits as unknown[]).length > 0;
  }
}
