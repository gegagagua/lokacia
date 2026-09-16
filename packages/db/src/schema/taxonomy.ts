import { boolean, doublePrecision, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns, geographyMultiPolygon } from './_common';

/** One filter definition inside business_types.filter_config (data-driven filters, P1). */
export type FilterDef = {
  key: string; // passport field key, e.g. "has_hood"
  kind: 'boolean' | 'range' | 'min';
  labelKa: string;
  labelEn?: string;
  labelRu?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type FilterConfig = {
  filters: FilterDef[];
  required: string[]; // passport fields required when publishing for this type (P2)
};

export const businessTypes = pgTable('business_types', {
  ...baseColumns,
  slug: text('slug').notNull().unique(),
  nameKa: text('name_ka').notNull(),
  nameEn: text('name_en').notNull(),
  nameRu: text('name_ru').notNull(),
  icon: text('icon').notNull().default('store'),
  filterConfig: jsonb('filter_config').$type<FilterConfig>().notNull(),
  utilityCoef: numeric('utility_coef', { precision: 8, scale: 2, mode: 'number' }).notNull().default(3),
  fitoutPerM2Minor: integer('fitout_per_m2_minor').notNull().default(30000),
  sort: integer('sort').notNull().default(0),
});

export const districts = pgTable(
  'districts',
  {
    ...baseColumns,
    city: text('city').notNull().default('tbilisi'),
    slug: text('slug').notNull(),
    nameKa: text('name_ka').notNull(),
    nameEn: text('name_en').notNull(),
    nameRu: text('name_ru').notNull(),
    boundary: jsonb('boundary').$type<{ type: 'MultiPolygon'; coordinates: number[][][][] }>().notNull(),
    geom: geographyMultiPolygon('geom').generatedAlwaysAs(
      sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(boundary::text), 4326))::geography`,
    ),
    centerLat: doublePrecision('center_lat').notNull(),
    centerLng: doublePrecision('center_lng').notNull(),
    /** Average monthly rent per m², in tetri. Recomputed by district stats job. */
    avgPriceM2Minor: integer('avg_price_m2_minor').notNull().default(0),
    /** Admin override for the district average rent per m² (tetri); wins over the computed value. */
    avgPriceM2OverrideMinor: integer('avg_price_m2_override_minor'),
    avgSalePriceM2Minor: integer('avg_sale_price_m2_minor').notNull().default(0),
    activeCount: integer('active_count').notNull().default(0),
    vacancyCount: integer('vacancy_count').notNull().default(0),
  },
  (t) => [uniqueIndex('districts_city_slug_uq').on(t.city, t.slug), index('districts_geom_gist').using('gist', t.geom)],
);

export const cmsPages = pgTable(
  'cms_pages',
  {
    ...baseColumns,
    kind: text('kind', { enum: ['permits', 'static'] }).notNull(),
    slug: text('slug').notNull(),
    businessTypeId: uuid('business_type_id'),
    locale: text('locale').notNull().default('ka'),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull(),
    published: boolean('published').notNull().default(true),
  },
  (t) => [uniqueIndex('cms_kind_slug_locale_uq').on(t.kind, t.slug, t.locale)],
);
