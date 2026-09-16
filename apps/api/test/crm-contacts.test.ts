import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, crmActivities, crmContacts, crmDeals, crmTasks, eq, memberships, users } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES, sys } from './crm-helpers';

describe('CRM contacts (C1): CRUD, search, visibility, dedup merge', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('creates a contact with E.164 phones and finds it by trigram name and phone digits', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const res = await manager.post('/v1/crm/contacts').send({ name: 'ზურაბ ქვარაცხელიძე', phones: ['599 12 34 56', '0322 22 33 44'], emails: ['Zurab@Example.ge'], tags: ['HoReCa'], source: 'facebook' });
    expect(res.status).toBe(201);
    expect(res.body.phones).toEqual(['+995599123456', '+995322223344']);
    expect(res.body.emails).toEqual(['zurab@example.ge']);
    expect(res.body.portalToken).toBeTruthy();

    const byTypo = await manager.get('/v1/crm/contacts').query({ q: 'ზურაბ ქვარაცხელიძ' });
    expect(byTypo.body.items[0].id).toBe(res.body.id);
    const byPhone = await manager.get('/v1/crm/contacts').query({ q: '599123456' });
    expect(byPhone.body.items.map((c: { id: string }) => c.id)).toContain(res.body.id);
    const byIntl = await manager.get('/v1/crm/contacts').query({ q: '+995 599 12 34 56' });
    expect(byIntl.body.items.map((c: { id: string }) => c.id)).toContain(res.body.id);
    const filtered = await manager.get('/v1/crm/contacts').query({ tag: 'HoReCa', source: 'facebook', type: 'client' });
    expect(filtered.body.items.every((c: { tags: string[]; source: string }) => c.tags.includes('HoReCa') && c.source === 'facebook')).toBe(true);

    const page1 = await manager.get('/v1/crm/contacts').query({ limit: 10 });
    expect(page1.body.items).toHaveLength(10);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await manager.get('/v1/crm/contacts').query({ limit: 10, cursor: page1.body.nextCursor });
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);

    const patched = await manager.patch(`/v1/crm/contacts/${res.body.id}`).send({ company: 'შპს „ტესტი“' });
    expect(patched.status).toBe(200);
    expect(patched.body.company).toBe('შპს „ტესტი“');
    expect(patched.body.tags).toEqual(['HoReCa']); // untouched keys keep values
  });

  it('agents only see their own contacts; assistants cannot delete', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const mine = await manager.post('/v1/crm/contacts').send({ name: 'მენეჯერის კლიენტი', phones: ['591000111'], ownerAgentId: manager.user.id });
    expect((await agent.get(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(404);
    expect((await manager.get(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(200);
    const list = await agent.get('/v1/crm/contacts').query({ limit: 200 });
    expect(list.body.items.every((c: { ownerAgentId: string }) => c.ownerAgentId === agent.user.id)).toBe(true);
    const own = await agent.post('/v1/crm/contacts').send({ name: 'აგენტის ლიდი', phones: ['591000222'] });
    expect(own.status).toBe(201);
    expect(own.body.ownerAgentId).toBe(agent.user.id);
    expect((await agent.get(`/v1/crm/contacts/${own.body.id}`)).status).toBe(200);

    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.get(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(200);
    expect((await assistant.delete(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(403);
    expect((await manager.delete(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(200);
    expect((await manager.get(`/v1/crm/contacts/${mine.body.id}`)).status).toBe(404);
  });

  it('denies cross-org access (guard 403, RLS 404)', async () => {
    const cityspaces = await orgIdBySlug(ctx.db, 'city-spaces');
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const [foreign] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, cityspaces)).limit(1));
    expect((await other.get('/v1/crm/contacts').set('x-org-id', cityspaces)).status).toBe(403);
    expect((await other.get(`/v1/crm/contacts/${foreign!.id}`)).status).toBe(404);
    expect((await other.patch(`/v1/crm/contacts/${foreign!.id}`).send({ name: 'hack' })).status).toBe(404);
    expect((await other.post('/v1/crm/contacts/merge').send({ targetId: foreign!.id, sourceIds: [foreign!.id] })).status).toBeGreaterThanOrEqual(400);
    const ownList = await other.get('/v1/crm/contacts').query({ limit: 200 });
    expect(ownList.body.items.map((c: { id: string }) => c.id)).not.toContain(foreign!.id);
  });

  it('detects seeded duplicates and merges them moving deals, tasks and activities', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const dups = await manager.get('/v1/crm/contacts/duplicates');
    expect(dups.status).toBe(200);
    expect(dups.body.length).toBeGreaterThanOrEqual(3);
    const phoneCluster = dups.body.find((c: { reasons: string[] }) => c.reasons.includes('phone'));
    expect(phoneCluster).toBeTruthy();

    // build a controlled duplicate pair with related records
    const a = await manager.post('/v1/crm/contacts').send({ name: 'ნინო ბერიძე', phones: ['+995577445566'], tags: ['VIP'], emails: ['nino@example.ge'] });
    const b = await manager.post('/v1/crm/contacts').send({ name: 'ნინო ბერიძ', phones: ['0577 44 55 66', '555 99 88 77'], tags: ['ოფისი'], company: 'შპს „ნოვა“' });
    const pair = (await manager.get('/v1/crm/contacts/duplicates')).body.find((c: { contacts: { id: string }[] }) => c.contacts.some((x) => x.id === a.body.id));
    expect(pair.contacts.map((x: { id: string }) => x.id)).toContain(b.body.id);

    const [pipeline] = await sys(ctx.db, (tx) => tx.query.crmPipelines.findMany({ where: (p, { eq: e }) => e(p.orgId, manager.orgId) }));
    const [deal] = await sys(ctx.db, (tx) => tx.insert(crmDeals).values({ orgId: manager.orgId, pipelineId: pipeline!.id, contactId: b.body.id, title: 'დუბლიკატის გარიგება', stage: 'lead' }).returning());
    await sys(ctx.db, (tx) => tx.insert(crmTasks).values({ orgId: manager.orgId, contactId: b.body.id, title: 'დაურეკე' }));
    await manager.post('/v1/crm/calls').send({ entityId: b.body.id, phone: '+995577445566', outcome: 'answered' });

    const merged = await manager.post('/v1/crm/contacts/merge').send({ targetId: a.body.id, sourceIds: [b.body.id] });
    expect(merged.status).toBe(200);
    expect(merged.body.moved.deals).toBe(1);

    const target = await manager.get(`/v1/crm/contacts/${a.body.id}`);
    expect(target.body.phones).toEqual(['+995577445566', '+995555998877']);
    expect(target.body.tags.sort()).toEqual(['VIP', 'ოფისი'].sort());
    expect(target.body.company).toBe('შპს „ნოვა“');
    expect(target.body.deals.map((d: { id: string }) => d.id)).toContain(deal!.id);
    expect(target.body.tasks).toHaveLength(1);

    const [src] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, b.body.id)));
    expect(src!.mergedIntoId).toBe(a.body.id);
    expect((await manager.get(`/v1/crm/contacts/${b.body.id}`)).status).toBe(404);
    const list = await manager.get('/v1/crm/contacts').query({ q: 'ნინო ბერიძ' });
    expect(list.body.items.map((c: { id: string }) => c.id)).not.toContain(b.body.id);
    const acts = await sys(ctx.db, (tx) => tx.select().from(crmActivities).where(and(eq(crmActivities.entity, 'contact'), eq(crmActivities.entityId, a.body.id))));
    expect(acts.map((x) => x.type)).toEqual(expect.arrayContaining(['call', 'merge']));
    void memberships;
    void users;
  });
});
