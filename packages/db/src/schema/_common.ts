import { customType, doublePrecision, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

export const newId = () => uuidv7();

/** Columns every table carries (CLAUDE.md conventions). */
export const baseColumns = {
  id: uuid('id').primaryKey().$defaultFn(newId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const ts = (name: string) => timestamp(name, { withTimezone: true });

/** PostGIS geography. Values are written through generated columns, so the TS type is opaque. */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
});
export const geographyMultiPolygon = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(MultiPolygon,4326)',
});

/** lat/lng numeric columns plus a generated, GiST-indexable geography point. */
export const pointColumns = () => ({
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  geom: geographyPoint('geom').generatedAlwaysAs(
    sql`CASE WHEN lat IS NULL OR lng IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END`,
  ),
});

export const ROLES = [
  'guest',
  'user',
  'broker',
  'agency_manager',
  'agency_assistant',
  'developer',
  'moderator',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

export const DEAL_TYPES = ['rent', 'sale', 'transfer', 'short_term'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'stale',
  'rented',
  'sold',
  'archived',
  'rejected',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
