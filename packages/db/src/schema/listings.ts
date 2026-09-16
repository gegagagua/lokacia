import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { DEAL_TYPES, LISTING_STATUSES, baseColumns, pointColumns, ts } from './_common';

export const projects = pgTable(
  'projects',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    address: text('address').notNull(),
    districtId: uuid('district_id'),
    completionDate: date('completion_date', { mode: 'string' }).notNull(),
    description: text('description'),
    floors: integer('floors'),
    coverUrl: text('cover_url'),
    ...pointColumns(),
  },
  (t) => [index('projects_geom_gist').using('gist', t.geom)],
);

export const listings = pgTable(
  'listings',
  {
    ...baseColumns,
    orgId: uuid('org_id'),
    ownerId: uuid('owner_id').notNull(),
    agentId: uuid('agent_id'),
    projectId: uuid('project_id'),
    slug: text('slug').notNull(),
    businessTypes: text('business_types').array().notNull().default(sql`'{}'::text[]`),
    dealType: text('deal_type', { enum: DEAL_TYPES }).notNull(),
    /** Main price in tetri. For rent: per month. For sale/transfer: total. For short_term: per month (see hour/day). */
    priceMinor: integer('price_minor').notNull(),
    currency: text('currency').notNull().default('GEL'),
    pricePeriod: text('price_period', { enum: ['month', 'total', 'day', 'hour'] }).notNull().default('month'),
    priceHourMinor: integer('price_hour_minor'),
    priceDayMinor: integer('price_day_minor'),
    serviceFeeMinor: integer('service_fee_minor').notNull().default(0),
    depositMonths: numeric('deposit_months', { precision: 4, scale: 1, mode: 'number' }).notNull().default(1),
    utilitiesIncluded: boolean('utilities_included').notNull().default(false),
    equipmentPriceMinor: integer('equipment_price_minor'),
    areaM2: numeric('area_m2', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    floor: integer('floor'),
    floorsTotal: integer('floors_total'),
    commissionPct: numeric('commission_pct', { precision: 5, scale: 2, mode: 'number' }),
    isOwner: boolean('is_owner').notNull().default(true),
    verifiedOwner: boolean('verified_owner').notNull().default(false),
    status: text('status', { enum: LISTING_STATUSES }).notNull().default('draft'),
    rejectReason: text('reject_reason'),
    lastConfirmedAt: ts('last_confirmed_at'),
    publishedAt: ts('published_at'),
    completionDate: date('completion_date', { mode: 'string' }),
    districtId: uuid('district_id'),
    city: text('city').notNull().default('tbilisi'),
    address: text('address').notNull(),
    title: text('title').notNull(),
    titleEn: text('title_en'),
    titleRu: text('title_ru'),
    description: text('description').notNull().default(''),
    descriptionEn: text('description_en'),
    descriptionRu: text('description_ru'),
    vipUntil: ts('vip_until'),
    videoUrl: text('video_url'),
    tourUrl: text('tour_url'),
    locationScore: integer('location_score'),
    ...pointColumns(),
  },
  (t) => [
    uniqueIndex('listings_slug_uq').on(t.slug),
    index('listings_geom_gist').using('gist', t.geom),
    index('listings_business_types_gin').using('gin', t.businessTypes),
    index('listings_status_district_deal_idx').on(t.status, t.districtId, t.dealType),
    index('listings_owner_idx').on(t.ownerId),
    index('listings_org_idx').on(t.orgId),
    index('listings_price_idx').on(t.priceMinor),
    index('listings_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`),
    index('listings_address_trgm').using('gin', sql`${t.address} gin_trgm_ops`),
  ],
);

export const spacePassports = pgTable('space_passports', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull().unique(),
  powerKw: numeric('power_kw', { precision: 8, scale: 2, mode: 'number' }),
  threePhase: boolean('three_phase'),
  ceilingM: numeric('ceiling_m', { precision: 5, scale: 2, mode: 'number' }),
  facadeM: numeric('facade_m', { precision: 6, scale: 2, mode: 'number' }),
  widthM: numeric('width_m', { precision: 6, scale: 2, mode: 'number' }),
  depthM: numeric('depth_m', { precision: 6, scale: 2, mode: 'number' }),
  hasHood: boolean('has_hood'),
  hasGas: boolean('has_gas'),
  wetPoints: integer('wet_points'),
  gateWM: numeric('gate_w_m', { precision: 5, scale: 2, mode: 'number' }),
  truckAccess: boolean('truck_access'),
  access247: boolean('access_24_7'),
  parking: integer('parking'),
  shopWindow: boolean('shop_window'),
  separateEntrance: boolean('separate_entrance'),
  ventilation: boolean('ventilation'),
  /** Optional polygon outline in metres [[x,y],...] for SpacePlan. Rectangle from width×depth otherwise. */
  outline: jsonb('outline').$type<[number, number][]>(),
});

export const listingMedia = pgTable(
  'listing_media',
  {
    ...baseColumns,
    listingId: uuid('listing_id'),
    uploaderId: uuid('uploader_id'),
    kind: text('kind', { enum: ['photo', 'video', 'plan', 'pano360', 'document'] }).notNull(),
    url: text('url').notNull(),
    storageKey: text('storage_key'),
    variants: jsonb('variants').$type<Record<string, string>>(),
    sort: integer('sort').notNull().default(0),
    isFloorplan: boolean('is_floorplan').notNull().default(false),
    width: integer('width'),
    height: integer('height'),
    status: text('status', { enum: ['uploading', 'processing', 'ready', 'failed'] }).notNull().default('ready'),
    alt: text('alt'),
  },
  (t) => [index('media_listing_idx').on(t.listingId, t.sort)],
);

export const listingHistory = pgTable('listing_history', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  businessName: text('business_name').notNull(),
  businessType: text('business_type'),
  startedAt: date('started_at', { mode: 'string' }).notNull(),
  endedAt: date('ended_at', { mode: 'string' }),
  note: text('note'),
});

export const transferEquipment = pgTable('transfer_equipment', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  name: text('name').notNull(),
  qty: integer('qty').notNull().default(1),
  priceMinor: integer('price_minor').notNull(),
});

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    kind: text('kind', { enum: ['viewing', 'short_term'] }).notNull(),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    priceMinor: integer('price_minor'),
    bookedById: uuid('booked_by_id'),
    bookedAt: ts('booked_at'),
  },
  (t) => [index('slots_listing_idx').on(t.listingId, t.startsAt)],
);

export const ownerVerifications = pgTable('owner_verifications', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  userId: uuid('user_id').notNull(),
  documentUrl: text('document_url').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: ts('reviewed_at'),
  note: text('note'),
});

export const livenessChecks = pgTable(
  'liveness_checks',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    channel: text('channel').notNull(),
    token: text('token').notNull(),
    sentAt: ts('sent_at').notNull(),
    expiresAt: ts('expires_at').notNull(),
    confirmedAt: ts('confirmed_at'),
    result: text('result', { enum: ['pending', 'confirmed', 'rented', 'expired'] }).notNull().default('pending'),
  },
  (t) => [uniqueIndex('liveness_token_uq').on(t.token), index('liveness_listing_idx').on(t.listingId)],
);

export const prebookings = pgTable('prebookings', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  projectId: uuid('project_id'),
  userId: uuid('user_id').notNull(),
  message: text('message'),
  phone: text('phone'),
  status: text('status', { enum: ['requested', 'contacted', 'reserved', 'cancelled'] }).notNull().default('requested'),
});
