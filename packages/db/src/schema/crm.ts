import { boolean, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns, pointColumns, ts } from './_common';

/** Every table in this file is org-owned and protected by RLS (see drizzle/0002_rls.sql). */

export type ContactRequirements = {
  businessType?: string;
  dealType?: string;
  areaMin?: number;
  areaMax?: number;
  budgetMaxMinor?: number;
  districtIds?: string[];
  notes?: string;
};

export type PipelineStage = { key: string; name: string; kind: 'open' | 'won' | 'lost' };
export type SequenceStep = { delayDays: number; channel: 'sms' | 'email' | 'telegram'; template: string };

export const crmContacts = pgTable(
  'crm_contacts',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    type: text('type', { enum: ['client', 'owner', 'partner'] }).notNull().default('client'),
    name: text('name').notNull(),
    company: text('company'),
    phones: text('phones').array().notNull().default(sql`'{}'::text[]`),
    emails: text('emails').array().notNull().default(sql`'{}'::text[]`),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    source: text('source'),
    requirements: jsonb('requirements').$type<ContactRequirements>(),
    ownerAgentId: uuid('owner_agent_id'),
    notes: text('notes'),
    mergedIntoId: uuid('merged_into_id'),
    portalToken: text('portal_token'),
    lastContactedAt: ts('last_contacted_at'),
  },
  (t) => [
    index('crm_contacts_org_idx').on(t.orgId),
    index('crm_contacts_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
    index('crm_contacts_tags_gin').using('gin', t.tags),
    index('crm_contacts_phones_gin').using('gin', t.phones),
    uniqueIndex('crm_contacts_portal_token_uq').on(t.portalToken).where(sql`${t.portalToken} IS NOT NULL`),
  ],
);

export const crmPipelines = pgTable('crm_pipelines', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  stages: jsonb('stages').$type<PipelineStage[]>().notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});

export const crmDeals = pgTable(
  'crm_deals',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    pipelineId: uuid('pipeline_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    listingId: uuid('listing_id'),
    title: text('title').notNull(),
    stage: text('stage').notNull(),
    position: integer('position').notNull().default(0),
    valueMinor: integer('value_minor').notNull().default(0),
    commissionPct: numeric('commission_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(10),
    commissionMinor: integer('commission_minor').notNull().default(0),
    agentId: uuid('agent_id'),
    agentSharePct: numeric('agent_share_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(50),
    source: text('source'),
    lostReason: text('lost_reason'),
    expectedCloseAt: ts('expected_close_at'),
    closedAt: ts('closed_at'),
    stageChangedAt: ts('stage_changed_at').notNull().defaultNow(),
  },
  (t) => [index('crm_deals_org_stage_idx').on(t.orgId, t.stage)],
);

export const crmTasks = pgTable(
  'crm_tasks',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    dealId: uuid('deal_id'),
    contactId: uuid('contact_id'),
    title: text('title').notNull(),
    dueAt: ts('due_at'),
    assigneeId: uuid('assignee_id'),
    priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
    doneAt: ts('done_at'),
    remindedAt: ts('reminded_at'),
  },
  (t) => [index('crm_tasks_org_due_idx').on(t.orgId, t.dueAt)],
);

export const crmActivities = pgTable(
  'crm_activities',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    entity: text('entity', { enum: ['contact', 'deal', 'listing'] }).notNull(),
    entityId: uuid('entity_id').notNull(),
    type: text('type').notNull(), // note | call | stage_change | email | sms | viewing | merge | import
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid('created_by'),
  },
  (t) => [index('crm_activities_entity_idx').on(t.orgId, t.entity, t.entityId)],
);

export const crmMatches = pgTable(
  'crm_matches',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    listingId: uuid('listing_id').notNull(),
    score: integer('score').notNull().default(0),
    status: text('status', { enum: ['new', 'sent', 'liked', 'disliked', 'dismissed'] }).notNull().default('new'),
    clientComment: text('client_comment'),
    notifiedAt: ts('notified_at'),
  },
  (t) => [uniqueIndex('crm_matches_contact_listing_uq').on(t.contactId, t.listingId)],
);

export const crmViewings = pgTable(
  'crm_viewings',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    contactId: uuid('contact_id'),
    listingId: uuid('listing_id'),
    dealId: uuid('deal_id'),
    agentId: uuid('agent_id'),
    title: text('title').notNull(),
    address: text('address'),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    status: text('status', { enum: ['planned', 'done', 'cancelled'] }).notNull().default('planned'),
    routeOrder: integer('route_order'),
    googleEventId: text('google_event_id'),
    ...pointColumns(),
  },
  (t) => [index('crm_viewings_org_start_idx').on(t.orgId, t.startsAt)],
);

export const crmSequences = pgTable('crm_sequences', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  trigger: text('trigger', { enum: ['after_viewing', 'new_lead', 'manual'] }).notNull().default('manual'),
  steps: jsonb('steps').$type<SequenceStep[]>().notNull(),
  active: boolean('active').notNull().default(true),
});

export const crmSequenceRuns = pgTable(
  'crm_sequence_runs',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    sequenceId: uuid('sequence_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    dealId: uuid('deal_id'),
    step: integer('step').notNull().default(0),
    nextAt: ts('next_at'),
    lastRunAt: ts('last_run_at'),
    status: text('status', { enum: ['running', 'done', 'stopped'] }).notNull().default('running'),
  },
  (t) => [index('crm_seq_runs_next_idx').on(t.status, t.nextAt)],
);

export const crmLeadSources = pgTable(
  'crm_lead_sources',
  {
    ...baseColumns,
    orgId: uuid('org_id').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    monthlyCostMinor: integer('monthly_cost_minor').notNull().default(0),
  },
  (t) => [uniqueIndex('crm_lead_sources_org_key_uq').on(t.orgId, t.key)],
);

export const crmImports = pgTable('crm_imports', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  createdBy: uuid('created_by'),
  fileName: text('file_name').notNull(),
  mapping: jsonb('mapping').$type<Record<string, string>>().notNull(),
  status: text('status', { enum: ['pending', 'done', 'failed'] }).notNull().default('pending'),
  rowsTotal: integer('rows_total').notNull().default(0),
  rowsImported: integer('rows_imported').notNull().default(0),
  errors: jsonb('errors').$type<{ row: number; message: string }[]>(),
});

export const presentations = pgTable('presentations', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  createdBy: uuid('created_by'),
  contactId: uuid('contact_id'),
  title: text('title').notNull(),
  message: text('message'),
  listingIds: uuid('listing_ids').array().notNull().default(sql`'{}'::uuid[]`),
  token: text('token').notNull().unique(),
  openedAt: ts('opened_at'),
  openCount: integer('open_count').notNull().default(0),
});

export const documents = pgTable('documents', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  dealId: uuid('deal_id'),
  contactId: uuid('contact_id'),
  parentId: uuid('parent_id'),
  template: text('template', { enum: ['exclusivity', 'act', 'lease', 'custom'] }).notNull(),
  title: text('title').notNull(),
  version: integer('version').notNull().default(1),
  content: jsonb('content').$type<Record<string, unknown>>(),
  url: text('url'),
  signStatus: text('sign_status', { enum: ['draft', 'sent', 'signed', 'declined'] }).notNull().default('draft'),
  signProvider: text('sign_provider'),
  signRef: text('sign_ref'),
  signedAt: ts('signed_at'),
  createdBy: uuid('created_by'),
});

export const coBrokerShares = pgTable('co_broker_shares', {
  ...baseColumns,
  listingId: uuid('listing_id').notNull(),
  fromOrgId: uuid('from_org_id').notNull(),
  toOrgId: uuid('to_org_id').notNull(),
  splitPct: numeric('split_pct', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  status: text('status', { enum: ['proposed', 'accepted', 'declined', 'revoked'] }).notNull().default('proposed'),
  note: text('note'),
});

export const competitorTracks = pgTable('competitor_tracks', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  listingId: uuid('listing_id'),
  url: text('url').notNull(),
  portal: text('portal').notNull(),
  lastPriceMinor: integer('last_price_minor'),
  lastCheckedAt: ts('last_checked_at'),
  status: text('status', { enum: ['active', 'removed', 'error'] }).notNull().default('active'),
});

export const competitorPriceChanges = pgTable('competitor_price_changes', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  trackId: uuid('track_id').notNull(),
  oldPriceMinor: integer('old_price_minor'),
  newPriceMinor: integer('new_price_minor').notNull(),
});

export const ownerReports = pgTable('owner_reports', {
  ...baseColumns,
  orgId: uuid('org_id').notNull(),
  listingId: uuid('listing_id').notNull(),
  weekStart: text('week_start').notNull(),
  payload: jsonb('payload').$type<{ views: number; reveals: number; saves: number; viewings: number }>().notNull(),
  sentAt: ts('sent_at'),
});
