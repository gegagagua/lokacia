import { Injectable } from '@nestjs/common';
import { and, asc, businessTypes, cmsPages, districts, eq, sql } from '@lokacia/db';
import { DbService } from '../../common/db.service';

type DistrictLite = { id: string; slug: string; city: string; nameKa: string; nameEn: string; nameRu: string; centerLat: number; centerLng: number; avgPriceM2Minor: number; activeCount: number; vacancyCount: number };

/** Taxonomy is read constantly and changes rarely: cache in memory for 60 s. */
@Injectable()
export class TaxonomyService {
  private cache: { at: number; types: (typeof businessTypes.$inferSelect)[]; districts: DistrictLite[] } | null = null;
  constructor(private readonly dbs: DbService) {}

  invalidate() {
    this.cache = null;
  }

  private async load() {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache;
    const types = await this.dbs.db.select().from(businessTypes).where(sql`${businessTypes.deletedAt} IS NULL`).orderBy(asc(businessTypes.sort));
    const ds = await this.dbs.db
      .select({ id: districts.id, slug: districts.slug, city: districts.city, nameKa: districts.nameKa, nameEn: districts.nameEn, nameRu: districts.nameRu, centerLat: districts.centerLat, centerLng: districts.centerLng, avgPriceM2Minor: districts.avgPriceM2Minor, activeCount: districts.activeCount, vacancyCount: districts.vacancyCount })
      .from(districts)
      .orderBy(asc(districts.city), asc(districts.nameKa));
    this.cache = { at: Date.now(), types, districts: ds };
    return this.cache;
  }

  async businessTypes() {
    return (await this.load()).types;
  }
  async businessType(slug: string) {
    return (await this.load()).types.find((t) => t.slug === slug) ?? null;
  }
  async districts(city?: string) {
    const all = (await this.load()).districts;
    return city ? all.filter((d) => d.city === city) : all;
  }
  async districtBySlug(slug: string, city?: string) {
    return (await this.load()).districts.find((d) => d.slug === slug && (!city || d.city === city)) ?? null;
  }
  async districtById(id: string | null | undefined) {
    if (!id) return null;
    return (await this.load()).districts.find((d) => d.id === id) ?? null;
  }

  /** District containing a point (PostGIS). */
  async districtAt(lat: number, lng: number) {
    const rows = await this.dbs.db.execute<{ id: string }>(
      sql`select id from districts where ST_Intersects(geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) limit 1`,
    );
    return rows[0]?.id ?? null;
  }

  async districtGeojson(city = 'tbilisi') {
    const rows = await this.dbs.db
      .select({ id: districts.id, slug: districts.slug, nameKa: districts.nameKa, boundary: districts.boundary, avg: districts.avgPriceM2Minor, active: districts.activeCount, vacancy: districts.vacancyCount })
      .from(districts)
      .where(eq(districts.city, city));
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({ type: 'Feature', id: r.id, properties: { id: r.id, slug: r.slug, name: r.nameKa, avgPriceM2: Math.round(r.avg / 100), active: r.active, vacancy: r.vacancy }, geometry: r.boundary })),
    };
  }

  permits(slug: string, locale = 'ka') {
    return this.dbs.db.query.cmsPages.findFirst({ where: and(eq(cmsPages.kind, 'permits'), eq(cmsPages.slug, slug), eq(cmsPages.locale, locale), eq(cmsPages.published, true)) });
  }

  page(slug: string, locale = 'ka') {
    return this.dbs.db.query.cmsPages.findFirst({ where: and(eq(cmsPages.kind, 'static'), eq(cmsPages.slug, slug), eq(cmsPages.locale, locale), eq(cmsPages.published, true)) });
  }
}
