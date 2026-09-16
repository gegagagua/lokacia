import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createDb(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, { max: opts.max ?? 10, onnotice: () => undefined });
  const db = drizzle(client, { schema, casing: undefined });
  return { db, client };
}

/**
 * Run `fn` inside a transaction scoped to one organization. RLS policies on org-owned
 * tables compare `org_id` with `app.org_id`, so queries cannot see other orgs' rows.
 */
export async function withOrg<T>(db: Db, orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true), set_config('app.bypass_rls', 'off', true)`);
    return fn(tx);
  });
}

/** System context (jobs, admin, public token links) — explicitly bypasses org RLS. */
export async function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx);
  });
}

/** Tables protected by org RLS. Kept here so migrations and tests share one list. */
export const RLS_TABLES = [
  'crm_contacts',
  'crm_pipelines',
  'crm_deals',
  'crm_tasks',
  'crm_activities',
  'crm_matches',
  'crm_viewings',
  'crm_sequences',
  'crm_sequence_runs',
  'crm_lead_sources',
  'crm_imports',
  'presentations',
  'documents',
  'competitor_tracks',
  'competitor_price_changes',
  'owner_reports',
  'co_broker_shares',
] as const;
