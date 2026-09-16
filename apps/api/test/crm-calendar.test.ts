import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmViewings, eq } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';
import { optimizeRoute, pathKm } from '../src/modules/crm/calendar/route';

describe('CRM calendar (C4): viewings, Google sync mock, route optimization, ICS feed', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('2-opt route beats a zig-zag input order', () => {
    const start = { lat: 41.7, lng: 44.75 };
    const pts = [
      { id: 'd', lat: 41.7, lng: 44.8 },
      { id: 'a', lat: 41.7, lng: 44.76 },
      { id: 'c', lat: 41.7, lng: 44.78 },
      { id: 'b', lat: 41.7, lng: 44.77 },
    ];
    const { order, km } = optimizeRoute(start, pts);
    expect(order.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(km).toBeLessThan(pathKm(start, pts));
  });

  it('creates a viewing synced to the calendar adapter and logs activity', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, agent.orgId)).limit(1));
    const res = await agent.post('/v1/crm/viewings').send({ contactId: contact!.id, startsAt: '2026-10-01T10:00:00+04:00', durationMin: 30, address: 'ვაჟა-ფშაველას 10', lat: 41.72, lng: 44.75, title: 'ჩვენება ტესტ' });
    expect(res.status).toBe(201);
    expect(res.body.googleEventId).toBe(`gcal-mock-${res.body.id}`);
    expect(res.body.agentId).toBe(agent.user.id);
    expect(res.body.contactName).toBe(contact!.name);
    const tl = await agent.get(`/v1/crm/activities?entity=contact&entityId=${contact!.id}`);
    expect(tl.body.some((a: { type: string }) => a.type === 'viewing')).toBe(true);
    const done = await agent.patch(`/v1/crm/viewings/${res.body.id}`).send({ status: 'done' });
    expect(done.body.status).toBe('done');
  });

  it('orders a day of viewings and applies the route', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const coords = [44.8, 44.76, 44.78, 44.77];
    const ids: string[] = [];
    for (const [i, lng] of coords.entries()) {
      const r = await agent.post('/v1/crm/viewings').send({ title: `R${i}`, startsAt: `2026-11-03T${10 + i}:00:00+04:00`, lat: 41.7, lng });
      ids.push(r.body.id);
    }
    const route = await agent.get('/v1/crm/viewings/route?date=2026-11-03&startLat=41.7&startLng=44.75');
    expect(route.status).toBe(200);
    expect(route.body.stops.map((s: { title: string }) => s.title)).toEqual(['R1', 'R3', 'R2', 'R0']);
    expect(route.body.totalKm).toBeLessThan(route.body.originalKm);
    const apply = await agent.post('/v1/crm/viewings/route/apply').send({ order: route.body.stops.map((s: { id: string }) => s.id), shiftTimes: true, dayStart: '09:30' });
    expect(apply.status).toBe(200);
    const rows = await sys(ctx.db, (tx) => tx.select().from(crmViewings).where(eq(crmViewings.id, ids[1]!)));
    expect(rows[0]!.routeOrder).toBe(1);
    expect(rows[0]!.startsAt.toISOString()).toBe('2026-11-03T05:30:00.000Z');
  });

  it('agents only see their own viewings; managers see all', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const mine = await agent.get('/v1/crm/viewings');
    expect(mine.body.every((v: { agentId: string }) => v.agentId === agent.user.id)).toBe(true);
    const all = await manager.get('/v1/crm/viewings');
    expect(all.body.length).toBeGreaterThan(mine.body.length);
    const foreign = all.body.find((v: { agentId: string }) => v.agentId !== agent.user.id);
    expect((await agent.get(`/v1/crm/viewings/${foreign.id}`)).status).toBe(404);
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get(`/v1/crm/viewings/${foreign.id}`)).status).toBe(404);
  });

  it('serves a per-agent ICS feed with a secret token', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const { body } = await agent.get('/v1/crm/calendar/feed-url');
    const path = new URL(body.url).pathname;
    const ics = await ctx.http().get(path);
    expect(ics.status).toBe(200);
    expect(ics.headers['content-type']).toMatch(/text\/calendar/);
    expect(ics.text).toContain('BEGIN:VCALENDAR');
    expect(ics.text).toContain('BEGIN:VEVENT');
    const bad = await ctx.http().get(path.replace(/.{4}\.ics$/, 'ffff.ics'));
    expect(bad.status).toBe(404);
    const g = await agent.post('/v1/crm/calendar/google/connect');
    expect(g.body.connected).toBe(true);
  });
});
