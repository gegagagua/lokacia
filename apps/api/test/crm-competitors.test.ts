import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull, listings, notifications } from '@lokacia/db';
import { COMPETITORS, type CompetitorPriceChecker } from '../src/integrations/competitors/competitors';
import { createApp } from './helpers';
import { crmLogin, PHONES } from './crm-helpers';

describe('C15 competitor monitoring', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('tracks a URL, logs price changes, notifies the agent, marks removed listings', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [listing] = await ctx.db.select().from(listings).where(and(eq(listings.orgId, manager.orgId), eq(listings.status, 'active'), isNull(listings.deletedAt))).limit(1);
    const checker = ctx.app.get<CompetitorPriceChecker>(COMPETITORS);
    const spy = vi.spyOn(checker, 'check');

    spy.mockResolvedValueOnce(250_000);
    const created = await manager.post('/v1/crm/competitors').send({ listingId: listing!.id, url: 'https://ss.ge/ka/udzrava-qoneba/test-12345' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ portal: 'ss.ge', lastPriceMinor: 250_000, status: 'active', listingId: listing!.id });

    const dup = await manager.post('/v1/crm/competitors').send({ url: 'https://ss.ge/ka/udzrava-qoneba/test-12345' });
    expect(dup.status).toBe(409);

    const agentUserId = listing!.agentId ?? listing!.ownerId;
    const notifs = async () => (await ctx.db.select().from(notifications).where(and(eq(notifications.userId, agentUserId), eq(notifications.template, 'crm_competitor_price')))).length;
    const before = await notifs();

    spy.mockResolvedValueOnce(230_000);
    const checked = await manager.post(`/v1/crm/competitors/${created.body.id}/check`);
    expect(checked.status).toBe(200);
    expect(checked.body.lastPriceMinor).toBe(230_000);
    const changes = await manager.get(`/v1/crm/competitors/${created.body.id}/changes`);
    expect(changes.body[0]).toMatchObject({ oldPriceMinor: 250_000, newPriceMinor: 230_000 });
    expect(await notifs()).toBe(before + 1);

    spy.mockResolvedValueOnce(230_000);
    await manager.post(`/v1/crm/competitors/${created.body.id}/check`);
    expect((await manager.get(`/v1/crm/competitors/${created.body.id}/changes`)).body).toHaveLength(changes.body.length);

    spy.mockResolvedValueOnce(null);
    const removed = await manager.post(`/v1/crm/competitors/${created.body.id}/check`);
    expect(removed.body.status).toBe('removed');

    const byListing = await manager.get(`/v1/crm/competitors?listingId=${listing!.id}`);
    expect(byListing.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    // tenant isolation
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get('/v1/crm/competitors')).body.some((t: { id: string }) => t.id === created.body.id)).toBe(false);
    expect((await other.get(`/v1/crm/competitors/${created.body.id}/changes`)).status).toBe(404);
    expect((await other.post(`/v1/crm/competitors/${created.body.id}/check`)).status).toBe(404);
    expect((await other.post('/v1/crm/competitors').send({ listingId: listing!.id, url: 'https://myhome.ge/x/1' })).status).toBe(404);
    spy.mockRestore();
  });

  it('scheduled job checks all active tracks', async () => {
    const res = (await ctx.queue.runNow('crm.competitors.check')) as { checked: number; changed: number };
    expect(res.checked).toBeGreaterThan(0);
  });
});
