import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, eq } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES, sys } from './crm-helpers';

describe('CRM shared: context, permissions, call log, search, tenant isolation', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('returns workspace context with role-based permissions', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const res = await manager.get('/v1/crm/context');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('manager');
    expect(res.body.permissions).toContain('finance.view');
    expect(res.body.pipeline.stages.map((s: { key: string }) => s.key)).toContain('won');
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    const a = await assistant.get('/v1/crm/context');
    expect(a.body.role).toBe('assistant');
    expect(a.body.permissions).not.toContain('finance.view');
    expect(a.body.permissions).not.toContain('records.delete');
  });

  it('requires x-org-id and membership (manager of another agency is denied)', async () => {
    const cityspaces = await orgIdBySlug(ctx.db, 'city-spaces');
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get('/v1/crm/context')).body.org.slug).toBe('business-lokacia');
    const denied = await other.get('/v1/crm/search?q=ნი').set('x-org-id', cityspaces);
    expect(denied.status).toBe(403);
    const tenant = await (await import('./helpers')).loginAs(ctx.app, PHONES.tenant);
    expect((await tenant.get('/v1/crm/context').set('x-org-id', cityspaces)).status).toBe(403);
    expect((await tenant.get('/v1/crm/context')).status).toBe(400);
  });

  it('logs a call as an activity and shows it in the timeline (C7)', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, manager.orgId)).limit(1));
    const res = await manager.post('/v1/crm/calls').send({ entityId: contact!.id, phone: contact!.phones[0], outcome: 'answered', durationSec: 95, note: 'ჩვენება ხვალ' });
    expect(res.status).toBe(201);
    const tl = await manager.get(`/v1/crm/activities?entity=contact&entityId=${contact!.id}`);
    expect(tl.body[0]).toMatchObject({ type: 'call', payload: { outcome: 'answered', durationSec: 95 } });
    // cross-org: other agency cannot read this timeline (record not visible → 404, RLS would return nothing anyway)
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const leak = await other.get(`/v1/crm/activities?entity=contact&entityId=${contact!.id}`);
    expect(leak.status).toBe(404);
    expect(leak.body.id).toBeUndefined();
  });

  it('searches contacts by name and phone digits', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, manager.orgId)).limit(1));
    const digits = contact!.phones[0]!.replace(/\D/g, '').slice(-6);
    const byPhone = await manager.get(`/v1/crm/search?q=${digits}`);
    expect(byPhone.body.contacts.map((c: { id: string }) => c.id)).toContain(contact!.id);
    const byName = await manager.get(`/v1/crm/search?q=${encodeURIComponent(contact!.name.split(' ')[0]!)}`);
    expect(byName.body.contacts.length).toBeGreaterThan(0);
  });
});
