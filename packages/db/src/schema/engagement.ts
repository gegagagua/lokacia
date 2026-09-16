import { boolean, date, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { DEAL_TYPES, baseColumns, pointColumns, ts } from './_common';

export const pois = pgTable(
  'pois',
  {
    ...baseColumns,
    category: text('category', { enum: ['competitor', 'transport', 'school', 'business_center', 'parking', 'bank'] }).notNull(),
    businessType: text('business_type'),
    name: text('name').notNull(),
    source: text('source').notNull().default('osm'),
    sourceId: text('source_id').notNull(),
    ...pointColumns(),
  },
  (t) => [
    uniqueIndex('pois_source_uq').on(t.source, t.sourceId),
    index('pois_geom_gist').using('gist', t.geom),
    index('pois_category_idx').on(t.category, t.businessType),
  ],
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    ...baseColumns,
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    query: jsonb('query').$type<Record<string, unknown>>().notNull(),
    channels: text('channels').array().notNull().default(sql`'{email}'::text[]`),
    active: boolean('active').notNull().default(true),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    lastNotifiedAt: ts('last_notified_at'),
  },
  (t) => [index('saved_searches_user_idx').on(t.userId)],
);

export const demandRequests = pgTable('demand_requests', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  businessType: text('business_type').notNull(),
  dealType: text('deal_type', { enum: DEAL_TYPES }).notNull().default('rent'),
  areaMin: integer('area_min'),
  areaMax: integer('area_max'),
  budgetMinor: integer('budget_minor'),
  districtIds: uuid('district_ids').array().notNull().default(sql`'{}'::uuid[]`),
  title: text('title').notNull(),
  description: text('description'),
  contactPhone: text('contact_phone'),
  expiresAt: ts('expires_at').notNull(),
  status: text('status', { enum: ['active', 'closed', 'expired'] }).notNull().default('active'),
});

export const favorites = pgTable(
  'favorites',
  {
    ...baseColumns,
    userId: uuid('user_id').notNull(),
    listingId: uuid('listing_id').notNull(),
    note: text('note'),
  },
  (t) => [uniqueIndex('favorites_user_listing_uq').on(t.userId, t.listingId)],
);

export const compareLists = pgTable('compare_lists', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  name: text('name').notNull().default('შედარება'),
  listingIds: uuid('listing_ids').array().notNull().default(sql`'{}'::uuid[]`),
  shareToken: text('share_token').notNull().unique(),
});

export const listingEvents = pgTable(
  'listing_events',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    type: text('type', { enum: ['view', 'reveal', 'save', 'share'] }).notNull(),
    userId: uuid('user_id'),
    ipHash: text('ip_hash'),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('events_listing_at_idx').on(t.listingId, t.at), index('events_type_ip_idx').on(t.type, t.ipHash, t.at)],
);

export const listingStatsDaily = pgTable(
  'listing_stats_daily',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    views: integer('views').notNull().default(0),
    reveals: integer('reveals').notNull().default(0),
    saves: integer('saves').notNull().default(0),
    shares: integer('shares').notNull().default(0),
  },
  (t) => [uniqueIndex('stats_listing_day_uq').on(t.listingId, t.day)],
);

export const offers = pgTable(
  'offers',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    fromUserId: uuid('from_user_id').notNull(),
    toUserId: uuid('to_user_id').notNull(),
    parentOfferId: uuid('parent_offer_id'),
    rootOfferId: uuid('root_offer_id'),
    priceMinor: integer('price_minor').notNull(),
    termMonths: integer('term_months').notNull(),
    freeMonths: integer('free_months').notNull().default(0),
    indexationPct: integer('indexation_pct').notNull().default(0),
    fitoutPaidBy: text('fitout_paid_by', { enum: ['tenant', 'owner', 'shared'] }).notNull().default('tenant'),
    equipmentIncluded: boolean('equipment_included').notNull().default(false),
    message: text('message'),
    status: text('status', { enum: ['pending', 'countered', 'accepted', 'rejected', 'withdrawn'] })
      .notNull()
      .default('pending'),
    contractUrl: text('contract_url'),
  },
  (t) => [index('offers_listing_idx').on(t.listingId), index('offers_root_idx').on(t.rootOfferId)],
);

export const viewings = pgTable(
  'viewings',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    userId: uuid('user_id').notNull(),
    slotId: uuid('slot_id'),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    mode: text('mode', { enum: ['onsite', 'video'] }).notNull().default('onsite'),
    status: text('status', { enum: ['requested', 'confirmed', 'cancelled', 'done'] }).notNull().default('confirmed'),
    videoUrl: text('video_url'),
    note: text('note'),
    remindedAt: ts('reminded_at'),
  },
  (t) => [index('viewings_listing_idx').on(t.listingId, t.startsAt), index('viewings_user_idx').on(t.userId)],
);

export const conversations = pgTable(
  'conversations',
  {
    ...baseColumns,
    orgId: uuid('org_id'),
    listingId: uuid('listing_id'),
    contactId: uuid('contact_id'),
    participantIds: uuid('participant_ids').array().notNull().default(sql`'{}'::uuid[]`),
    channel: text('channel', { enum: ['portal', 'whatsapp', 'viber', 'telegram'] }).notNull().default('portal'),
    externalId: text('external_id'),
    subject: text('subject'),
    lastMessageAt: ts('last_message_at'),
  },
  (t) => [index('conversations_participants_gin').using('gin', t.participantIds), index('conversations_org_idx').on(t.orgId)],
);

export const messages = pgTable(
  'messages',
  {
    ...baseColumns,
    conversationId: uuid('conversation_id').notNull(),
    senderId: uuid('sender_id'),
    externalSender: text('external_sender'),
    direction: text('direction', { enum: ['in', 'out'] }).notNull().default('out'),
    body: text('body').notNull(),
    attachments: jsonb('attachments').$type<{ url: string; name: string; type: string }[]>(),
    readAt: ts('read_at'),
  },
  (t) => [index('messages_conv_idx').on(t.conversationId, t.createdAt)],
);

export const serviceProviders = pgTable('service_providers', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  categories: text('categories').array().notNull().default(sql`'{}'::text[]`),
  about: text('about'),
  logoUrl: text('logo_url'),
  phone: text('phone'),
  city: text('city').notNull().default('tbilisi'),
  priceFrom: text('price_from'),
  rating: integer('rating_x10').notNull().default(0),
  reviewsCount: integer('reviews_count').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
  portfolio: jsonb('portfolio').$type<string[]>(),
});

export const serviceOrders = pgTable('service_orders', {
  ...baseColumns,
  providerId: uuid('provider_id').notNull(),
  requesterId: uuid('requester_id').notNull(),
  listingId: uuid('listing_id'),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['requested', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled'] })
    .notNull()
    .default('requested'),
  quoteMinor: integer('quote_minor'),
  quoteNote: text('quote_note'),
  amountMinor: integer('amount_minor'),
  commissionPct: integer('commission_pct').notNull().default(10),
  commissionMinor: integer('commission_minor'),
  completedAt: ts('completed_at'),
});

export const reviews = pgTable(
  'reviews',
  {
    ...baseColumns,
    targetType: text('target_type', { enum: ['broker', 'provider', 'org'] }).notNull(),
    targetId: uuid('target_id').notNull(),
    authorId: uuid('author_id'),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    body: text('body'),
  },
  (t) => [index('reviews_target_idx').on(t.targetType, t.targetId)],
);

export const reportPurchases = pgTable('report_purchases', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  orgId: uuid('org_id'),
  districtId: uuid('district_id'),
  businessType: text('business_type'),
  productKey: text('product_key').notNull(),
  invoiceId: uuid('invoice_id'),
  status: text('status', { enum: ['pending', 'paid', 'ready'] }).notNull().default('pending'),
  url: text('url'),
  payload: jsonb('payload'),
});

export const trafficSamples = pgTable(
  'traffic_samples',
  {
    ...baseColumns,
    districtId: uuid('district_id'),
    listingId: uuid('listing_id'),
    provider: text('provider').notNull().default('mock'),
    weekday: integer('weekday').notNull(),
    hour: integer('hour').notNull(),
    count: integer('count').notNull(),
    ...pointColumns(),
  },
  (t) => [index('traffic_listing_idx').on(t.listingId), index('traffic_geom_gist').using('gist', t.geom)],
);

export const locationScores = pgTable(
  'location_scores',
  {
    ...baseColumns,
    listingId: uuid('listing_id').notNull(),
    businessType: text('business_type').notNull(),
    score: integer('score').notNull(),
    components: jsonb('components').$type<{ key: string; label: string; value: number; weight: number }[]>().notNull(),
    summary: text('summary'),
    computedAt: ts('computed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('scores_listing_type_uq').on(t.listingId, t.businessType)],
);
