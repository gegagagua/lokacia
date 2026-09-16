import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull, listings, livenessChecks, ownerReports, users } from '@lokacia/db';
import { SMS } from '../src/integrations/sms/sms';
import type { MockSms } from '../src/integrations/sms/sms.mock';
import { previousWeekStart } from '../src/modules/crm/marketing/owner-reports.service';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

describe('CRM marketing: owner reports (C13), liveness (C14), AI descriptions (C11), broker profile (C12)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('builds weekly owner reports once per listing per week and sends them', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.post('/v1/crm/owner-reports/run')).status).toBe(403);
    const first = await manager.post('/v1/crm/owner-reports/run');
    expect(first.status).toBe(200);
    expect(first.body.weekStart).toBe(previousWeekStart());
    expect(first.body.created).toBeGreaterThan(0);
    expect(first.body.sent).toBe(first.body.created);
    const second = await manager.post('/v1/crm/owner-reports/run');
    expect(second.body.created).toBe(0);

    const orgListings = await ctx.db.select({ id: listings.id }).from(listings).where(and(eq(listings.orgId, manager.orgId), inArray(listings.status, ['active', 'stale']), isNull(listings.deletedAt)));
    const rows = await sys(ctx.db, (tx) => tx.select().from(ownerReports).where(and(eq(ownerReports.orgId, manager.orgId), eq(ownerReports.weekStart, first.body.weekStart))));
    expect(rows).toHaveLength(orgListings.length);
    expect(rows.every((r) => r.sentAt)).toBe(true);
    expect(rows[0]!.payload).toEqual(expect.objectContaining({ views: expect.any(Number), reveals: expect.any(Number), viewings: expect.any(Number) }));

    const list = await manager.get('/v1/crm/owner-reports');
    expect(list.body.length).toBeGreaterThanOrEqual(rows.length);
    expect((await manager.get(`/v1/crm/owner-reports/${rows[0]!.id}`)).body.listingTitle).toBeTruthy();
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get(`/v1/crm/owner-reports/${rows[0]!.id}`)).status).toBe(404);
  });

  it('asks owners by SMS, skips pending checks, and lets the agent confirm on behalf', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const dash = await manager.get('/v1/crm/liveness');
    expect(dash.status).toBe(200);
    expect(dash.body.length).toBeGreaterThan(0);
    expect(['ok', 'due', 'overdue', 'stale']).toContain(dash.body[0].state);
    const target = dash.body.find((r: { status: string; lastCheck: { result: string } | null }) => r.status === 'active' && r.lastCheck?.result !== 'pending');
    const sms = ctx.app.get<MockSms>(SMS);
    const outboxBefore = sms.outbox.length;
    const asked = await manager.post('/v1/crm/liveness/ask').send({ listingIds: [target.id] });
    expect(asked.body).toEqual({ sent: 1, skipped: 0 });
    expect(sms.outbox.length).toBe(outboxBefore + 1);
    expect(sms.outbox.at(-1)!.text).toContain(`/confirm/${target.id}?token=`);
    const checks = await ctx.db.select().from(livenessChecks).where(and(eq(livenessChecks.listingId, target.id), eq(livenessChecks.result, 'pending')));
    expect(checks).toHaveLength(1);
    expect((await manager.post('/v1/crm/liveness/ask').send({ listingIds: [target.id] })).body).toEqual({ sent: 0, skipped: 1 });

    const confirmed = await manager.post(`/v1/crm/liveness/${target.id}/confirm`);
    expect(confirmed.status).toBe(200);
    const [l] = await ctx.db.select().from(listings).where(eq(listings.id, target.id));
    expect(Date.now() - l!.lastConfirmedAt!.getTime()).toBeLessThan(60_000);
    const [c] = await ctx.db.select().from(livenessChecks).where(eq(livenessChecks.id, checks[0]!.id));
    expect(c!.result).toBe('confirmed');

    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.post('/v1/crm/liveness/ask').send({ listingIds: [target.id] })).status).toBe(404);
    expect((await other.post(`/v1/crm/liveness/${target.id}/confirm`)).status).toBe(404);
    expect(typeof (await ctx.queue.runNow('crm.liveness.auto'))).toBe('number');
  });

  it('lists org listings with stats and generates ka/en/ru descriptions without an AI key', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const list = await manager.get('/v1/crm/listings');
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect(list.body[0]).toEqual(expect.objectContaining({ stats30d: expect.any(Object), agentName: expect.anything(), competitorTracks: expect.any(Number) }));
    const stats = await manager.get(`/v1/crm/listings/${list.body[0].id}/stats`);
    expect(stats.body.days).toHaveLength(30);
    const desc = await manager.post('/v1/ai/describe').send({ listingId: list.body[0].id, locales: ['ka', 'en', 'ru'] });
    expect(desc.status).toBe(200);
    expect(desc.body.ka.length).toBeGreaterThan(20);
    expect(desc.body.en.length).toBeGreaterThan(20);
    expect(desc.body.ru.length).toBeGreaterThan(20);
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get(`/v1/crm/listings/${list.body[0].id}/stats`)).status).toBe(404);
  });

  it('edits the broker public profile and rejects a taken slug', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const me = await agent.get('/v1/crm/profile');
    expect(me.status).toBe(200);
    const [manager] = await ctx.db.select().from(users).where(eq(users.phone, PHONES.agencyManager));
    const conflict = await agent.patch('/v1/crm/profile').send({ slug: manager!.slug });
    expect(conflict.status).toBe(409);
    const ok = await agent.patch('/v1/crm/profile').send({ slug: 'test-broker-slug', bio: 'კომერციული ფართების ბროკერი 8 წლის გამოცდილებით.' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ slug: 'test-broker-slug', publicUrl: expect.stringContaining('/broker/test-broker-slug') });
    expect((await agent.patch('/v1/crm/profile').send({ slug: 'Bad Slug!' })).status).toBe(422);
  });
});
