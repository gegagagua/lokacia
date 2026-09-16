import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmDeals, crmViewings, documents, eq, presentations, withSystem } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES } from './crm-helpers';

/** Tenant isolation across every CRM area: guard (x-org-id membership) + RLS (ids of another org are invisible). */
describe('CRM cross-org denial (guard + RLS)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  const LIST_ENDPOINTS = [
    '/v1/crm/context', '/v1/crm/contacts', '/v1/crm/contacts/duplicates', '/v1/crm/deals', '/v1/crm/pipelines/default', '/v1/crm/tasks', '/v1/crm/viewings',
    '/v1/crm/inbox', '/v1/crm/sequences', '/v1/crm/presentations', '/v1/crm/documents', '/v1/crm/cobroker', '/v1/crm/competitors', '/v1/crm/liveness',
    '/v1/crm/owner-reports', '/v1/crm/listings', '/v1/crm/team', '/v1/crm/sources', '/v1/crm/analytics/kpi', '/v1/crm/imports', '/v1/crm/audit', '/v1/crm/exports/contacts.csv',
  ];

  it('manager of business-lokacia gets 403 for every city-spaces endpoint', async () => {
    const cityspaces = await orgIdBySlug(ctx.db, 'city-spaces');
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    for (const path of LIST_ENDPOINTS) {
      const res = await other.get(path).set('x-org-id', cityspaces);
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });

  it('ids of city-spaces records are invisible inside business-lokacia (404)', async () => {
    const cityspaces = await orgIdBySlug(ctx.db, 'city-spaces');
    const ids = await withSystem(ctx.db, async (tx) => ({
      contact: (await tx.select().from(crmContacts).where(eq(crmContacts.orgId, cityspaces)).limit(1))[0]!.id,
      deal: (await tx.select().from(crmDeals).where(eq(crmDeals.orgId, cityspaces)).limit(1))[0]!.id,
      viewing: (await tx.select().from(crmViewings).where(eq(crmViewings.orgId, cityspaces)).limit(1))[0]!.id,
      document: (await tx.select().from(documents).where(eq(documents.orgId, cityspaces)).limit(1))[0]!.id,
      presentation: (await tx.select().from(presentations).where(eq(presentations.orgId, cityspaces)).limit(1))[0]!.id,
    }));
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const checks: [string, string][] = [
      ['GET', `/v1/crm/contacts/${ids.contact}`],
      ['GET', `/v1/crm/deals/${ids.deal}`],
      ['GET', `/v1/crm/viewings/${ids.viewing}`],
      ['GET', `/v1/crm/documents/${ids.document}`],
      ['GET', `/v1/crm/presentations/${ids.presentation}`],
      ['PATCH', `/v1/crm/contacts/${ids.contact}`],
      ['POST', `/v1/crm/deals/${ids.deal}/move`],
    ];
    for (const [method, path] of checks) {
      const req = method === 'GET' ? other.get(path) : method === 'PATCH' ? other.patch(path).send({ name: 'hack' }) : other.post(path).send({ stage: 'won', position: 0 });
      const res = await req;
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
    const board = await other.get('/v1/crm/deals');
    expect(JSON.stringify(board.body)).not.toContain(ids.deal);
  });
});
