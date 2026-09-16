import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { ROLES, baseColumns, ts } from './_common';

export const users = pgTable(
  'users',
  {
    ...baseColumns,
    phone: text('phone'),
    email: text('email'),
    name: text('name'),
    role: text('role', { enum: ROLES }).notNull().default('user'),
    avatarUrl: text('avatar_url'),
    verifiedAt: ts('verified_at'),
    locale: text('locale').notNull().default('ka'),
    googleId: text('google_id'),
    bannedAt: ts('banned_at'),
    banReason: text('ban_reason'),
    telegramChatId: text('telegram_chat_id'),
    viberId: text('viber_id'),
    telegramLinkToken: text('telegram_link_token'),
    notificationPrefs: jsonb('notification_prefs')
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    consentAt: ts('consent_at'),
    lastSeenAt: ts('last_seen_at'),
    slug: text('slug'),
    bio: text('bio'),
  },
  (t) => [
    uniqueIndex('users_phone_uq').on(t.phone).where(sql`${t.phone} IS NOT NULL`),
    uniqueIndex('users_email_uq').on(t.email).where(sql`${t.email} IS NOT NULL`),
    uniqueIndex('users_slug_uq').on(t.slug).where(sql`${t.slug} IS NOT NULL`),
    uniqueIndex('users_google_uq').on(t.googleId).where(sql`${t.googleId} IS NOT NULL`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    ...baseColumns,
    userId: uuid('user_id').notNull(),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    replacedById: uuid('replaced_by_id'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    impersonatorId: uuid('impersonator_id'),
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    ...baseColumns,
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: ts('consumed_at'),
    ip: text('ip'),
  },
  (t) => [index('otp_phone_idx').on(t.phone, t.createdAt)],
);

export const tenantProfiles = pgTable('tenant_profiles', {
  ...baseColumns,
  userId: uuid('user_id').notNull().unique(),
  activity: text('activity'),
  businessType: text('business_type'),
  companyName: text('company_name'),
  experienceYears: integer('experience_years'),
  desiredTermMonths: integer('desired_term_months'),
  employees: integer('employees'),
  website: text('website'),
  about: text('about'),
});

export const organizations = pgTable('organizations', {
  ...baseColumns,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['agency', 'developer'] }).notNull(),
  plan: text('plan').notNull().default('free'),
  logoUrl: text('logo_url'),
  about: text('about'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  website: text('website'),
  brandColor: text('brand_color'),
  leadDistribution: text('lead_distribution', { enum: ['round_robin', 'district', 'manual'] })
    .notNull()
    .default('round_robin'),
  rrCursor: integer('rr_cursor').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
});

export const memberships = pgTable(
  'memberships',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    userId: uuid('user_id'),
    invitedPhone: text('invited_phone'),
    role: text('role', { enum: ['manager', 'agent', 'assistant'] }).notNull().default('agent'),
    districtIds: uuid('district_ids').array().notNull().default(sql`'{}'::uuid[]`),
    acceptedAt: ts('accepted_at'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId).where(sql`${t.userId} IS NOT NULL`),
    index('memberships_phone_idx').on(t.invitedPhone),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    ...baseColumns,
    actorId: uuid('actor_id'),
    orgId: uuid('org_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    diff: jsonb('diff'),
    ip: text('ip'),
    impersonatorId: uuid('impersonator_id'),
  },
  (t) => [index('audit_org_idx').on(t.orgId, t.createdAt), index('audit_entity_idx').on(t.entity, t.entityId)],
);

export const settings = pgTable('settings', {
  ...baseColumns,
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
});

export const consents = pgTable('consents', {
  ...baseColumns,
  userId: uuid('user_id'),
  kind: text('kind').notNull(),
  granted: boolean('granted').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});

export const feedback = pgTable('feedback', {
  ...baseColumns,
  userId: uuid('user_id'),
  app: text('app').notNull().default('web'),
  path: text('path'),
  rating: integer('rating'),
  message: text('message').notNull(),
  status: text('status', { enum: ['new', 'seen', 'done'] }).notNull().default('new'),
});

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    ...baseColumns,
    name: text('name').notNull(),
    path: text('path'),
    sessionHash: text('session_hash'),
    props: jsonb('props'),
  },
  (t) => [index('analytics_name_idx').on(t.name, t.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    ...baseColumns,
    userId: uuid('user_id'),
    channel: text('channel', { enum: ['in_app', 'sms', 'email', 'telegram', 'viber', 'whatsapp', 'push'] }).notNull(),
    template: text('template').notNull(),
    to: text('to'),
    title: text('title'),
    body: text('body'),
    link: text('link'),
    payload: jsonb('payload'),
    status: text('status', { enum: ['queued', 'sent', 'failed', 'skipped'] }).notNull().default('queued'),
    sentAt: ts('sent_at'),
    readAt: ts('read_at'),
    error: text('error'),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);
