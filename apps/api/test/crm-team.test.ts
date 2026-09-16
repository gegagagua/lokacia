import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, crmContacts, districts, eq, notifications, organizations } from '@lokacia/db';
import { CrmEventsService } from '../src/modules/crm/shared/crm-events.service';
import { createApp, loginAs } from './helpers';
import { crmLogin, sys } from './crm-helpers';

describe('CRM team & lead distribution (C17)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let manager: Awaited<ReturnType<typeof crmLogin>>;
  let orgId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await createApp();
    const owner = await loginAs(ctx.app, '+995599400400');
    const org = await owner.post('/v1/orgs').send({ name: 'ლიდების ტესტ აგენტურა', type: 'agency' });
    orgId = org.body.id;
    ids.manager = owner.user.id;
    for (const [k, phone] of [
      ['a1', '+995599400401'],
      ['a2', '+995599400402'],
    ] as const) {
      const u = await loginAs(ctx.app, phone);
      ids[k] = u.user.id;
      await new Promise((r) => setTimeout(r, 5));
      expect((await owner.post('/v1/orgs/current/invites').set('x-org-id', orgId).send({ phone, role: 'agent' })).status).toBe(201);
    }
    manager = await crmLogin(ctx.app, '+995599400400', orgId);
  });
  afterAll(async () => ctx.app.close());

  const newLead = async (name: string, requirements: Record<string, unknown> | null = null) => {
    const [c] = await sys(ctx.db, (tx) => tx.insert(crmContacts).values({ orgId, name, source: 'facebook', requirements }).returning());
    await ctx.app.get(CrmEventsService).emit('contact.created', { orgId, contactId: c!.id, actorId: null, source: 'facebook' });
    const [after] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, c!.id)));
    return after!;
  };

  it('lists team members with stats', async () => {
    const res = await manager.get('/v1/crm/team');
    expect(res.status).toBe(200);
    expect(res.body.leadDistribution).toBe('round_robin');
    expect(res.body.members).toHaveLength(3);
    expect(res.body.members[0].stats).toMatchObject({ contacts: 0, openDeals: 0 });
  });

  it('round robin assigns consecutive leads to different members and advances rr_cursor', async () => {
    const got = [];
    for (let i = 0; i < 4; i++) got.push((await newLead(`ლიდი ${i}`)).ownerAgentId);
    expect(got.slice(0, 3)).toEqual([ids.manager, ids.a1, ids.a2]);
    expect(got[3]).toBe(ids.manager);
    const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org!.rrCursor).toBe(4);
    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, ids.a1!), eq(notifications.template, 'crm_lead_assigned')));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]!.link).toMatch(/\/contacts\//);
  });

  it('district mode assigns to the member covering the requested district, falls back to round robin', async () => {
    const [d1, d2] = await ctx.db.select().from(districts).limit(2);
    const members = (await manager.get('/v1/crm/team')).body.members as { id: string; userId: string }[];
    const m2 = members.find((m) => m.userId === ids.a2)!;
    expect((await manager.patch(`/v1/crm/team/members/${m2.id}`).send({ districtIds: [d1!.id] })).status).toBe(200);
    expect((await manager.patch('/v1/crm/team/settings').send({ leadDistribution: 'district' })).status).toBe(200);
    for (let i = 0; i < 3; i++) expect((await newLead(`უბნის ლიდი ${i}`, { districtIds: [d1!.id] })).ownerAgentId).toBe(ids.a2);
    const fallback = await newLead('სხვა უბანი', { districtIds: [d2!.id] });
    expect(fallback.ownerAgentId).toBeTruthy();
  });

  it('manual mode leaves leads unassigned; manager can re-run distribution; agents cannot manage the team', async () => {
    expect((await manager.patch('/v1/crm/team/settings').send({ leadDistribution: 'manual' })).status).toBe(200);
    const c = await newLead('ხელით');
    expect(c.ownerAgentId).toBeNull();
    const run = await manager.post(`/v1/crm/team/distribute/${c.id}`);
    expect(run.status).toBe(200);
    expect([ids.manager, ids.a1, ids.a2]).toContain(run.body.agentId);
    const agent = await crmLogin(ctx.app, '+995599400401', orgId);
    expect((await agent.patch('/v1/crm/team/settings').send({ leadDistribution: 'round_robin' })).status).toBe(403);
    expect((await agent.post(`/v1/crm/team/distribute/${c.id}`)).status).toBe(403);
  });

  it('keeps an explicitly assigned owner', async () => {
    await manager.patch('/v1/crm/team/settings').send({ leadDistribution: 'round_robin' });
    const [c] = await sys(ctx.db, (tx) => tx.insert(crmContacts).values({ orgId, name: 'მინიჭებული', ownerAgentId: ids.a1 }).returning());
    await ctx.app.get(CrmEventsService).emit('contact.created', { orgId, contactId: c!.id, actorId: null, source: null });
    const [after] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, c!.id)));
    expect(after!.ownerAgentId).toBe(ids.a1);
  });
});
