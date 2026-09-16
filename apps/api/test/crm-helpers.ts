import type { INestApplication } from '@nestjs/common';
import { eq, organizations, withSystem, type Db } from '@lokacia/db';
import { loginAs, PHONES } from './helpers';

export { PHONES };

export async function orgIdBySlug(db: Db, slug: 'city-spaces' | 'business-lokacia' | string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org) throw new Error(`org ${slug} not found`);
  return org.id;
}

/**
 * Logs in and returns a supertest agent that sends `x-org-id` on every request (CRM endpoints).
 * Default org = first membership of the user (city-spaces for the demo agency accounts).
 */
export async function crmLogin(app: INestApplication, phone: string, orgId?: string) {
  const agent = await loginAs(app, phone);
  const id = orgId ?? agent.user.orgs[0]?.id;
  if (!id) throw new Error(`user ${phone} has no org`);
  agent.set('x-org-id', id);
  return Object.assign(agent, { orgId: id });
}

/** Run a callback with RLS bypass (test fixtures / assertions on org tables). */
export function sys<T>(db: Db, fn: Parameters<typeof withSystem<T>>[1]) {
  return withSystem(db, fn);
}
