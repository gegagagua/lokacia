import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, demandRequests, eq, listingEvents, messages, notifications, prebookings, serviceOrders, sql } from '@lokacia/db';
import { createApp, loginAs, PHONES } from './helpers';

const cafeInVake = {
  businessTypes: ['cafe'],
  dealType: 'rent',
  title: 'ალერტის ტესტ კაფე ვაკეში',
  description: 'ტესტ',
  address: 'თბილისი, ჭავჭავაძის პრ. 12',
  lat: 41.7085,
  lng: 44.752,
  areaM2: 70,
  priceMinor: 250000,
  passport: { powerKw: 25, ceilingM: 3.4, hasHood: true, hasGas: true, wetPoints: 2, widthM: 7, depthM: 10 },
};

describe('portal: alerts, favorites, compare, demand, services, projects, profiles, seo', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('P7: publishing a listing notifies matching saved searches (Phase 6 done-when), not others; unsubscribe works', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const agent = await loginAs(ctx.app, PHONES.agent);
    const match = await tenant.post('/v1/saved-searches').send({ name: 'კაფე ვაკეში 3 000-მდე', query: { businessType: 'cafe', districts: ['vake'], priceMax: 3000, hasHood: true }, channels: ['in_app', 'email'] });
    expect(match.status).toBe(201);
    expect(match.body.matchCount).toBeGreaterThanOrEqual(0);
    const noMatch = await agent.post('/v1/saved-searches').send({ name: 'საწყობი', query: { businessType: 'warehouse' }, channels: ['in_app'] });
    expect(noMatch.status).toBe(201);
    const tooCheap = await agent.post('/v1/saved-searches').send({ name: 'იაფი კაფე', query: { businessType: 'cafe', priceMax: 1000 }, channels: ['in_app'] });
    expect(tooCheap.status).toBe(201);

    const owner = await loginAs(ctx.app, PHONES.owner);
    const created = await owner.post('/v1/listings').send({ ...cafeInVake, submit: true });
    expect(created.status).toBe(201);
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const started = Date.now();
    expect((await mod.post(`/v1/listings/${created.body.id}/status`).send({ status: 'active' })).status).toBe(200);
    await ctx.queue.drain();

    const rows = await ctx.db.select().from(notifications).where(and(eq(notifications.template, 'listing_alert'), sql`${notifications.link} = ${`/listings/${created.body.slug}`}`));
    const inApp = rows.filter((r) => r.channel === 'in_app');
    expect([...new Set(inApp.map((r) => r.userId))]).toEqual([tenant.user.id]); // the agent's non-matching searches are not notified
    expect(inApp[0]!.body).toContain('ალერტის ტესტ კაფე');
    expect(rows.some((r) => r.channel === 'email')).toBe(true);
    expect(inApp[0]!.createdAt.getTime() - started).toBeLessThan(60_000);

    const list = await tenant.get('/v1/saved-searches');
    const mine = list.body.find((s: { id: string }) => s.id === match.body.id);
    expect(mine.lastNotifiedAt).toBeTruthy();

    // unsubscribe via public token
    const [row] = await ctx.db.execute<{ unsubscribe_token: string }>(sql`SELECT unsubscribe_token FROM saved_searches WHERE id = ${match.body.id}`);
    expect((await ctx.http().get(`/v1/saved-searches/unsubscribe/${row!.unsubscribe_token}`)).body.active).toBe(true);
    expect((await ctx.http().post('/v1/saved-searches/unsubscribe').send({ token: row!.unsubscribe_token })).status).toBe(200);
    expect((await tenant.get('/v1/saved-searches')).body.find((s: { id: string }) => s.id === match.body.id).active).toBe(false);

    // other users cannot touch it; owner can delete
    expect((await agent.patch(`/v1/saved-searches/${match.body.id}`).send({ active: true })).status).toBe(404);
    expect((await tenant.delete(`/v1/saved-searches/${match.body.id}`)).status).toBe(200);
    expect((await tenant.get('/v1/saved-searches')).body.some((s: { id: string }) => s.id === match.body.id)).toBe(false);
  });

  it('P14: favorites record a save event; compare ≤ 6 with a public read-only share link', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const search = await ctx.http().get('/v1/listings').query({ limit: 7 });
    const ids: string[] = search.body.items.map((i: { id: string }) => i.id);
    expect(ids.length).toBe(7);

    await tenant.delete(`/v1/favorites/${ids[0]}`);
    const before = await ctx.db.$count(listingEvents, and(eq(listingEvents.listingId, ids[0]!), eq(listingEvents.type, 'save')));
    expect((await tenant.post('/v1/favorites').send({ listingId: ids[0] })).status).toBe(200);
    expect((await tenant.post('/v1/favorites').send({ listingId: ids[0] })).status).toBe(200); // idempotent
    const after = await ctx.db.$count(listingEvents, and(eq(listingEvents.listingId, ids[0]!), eq(listingEvents.type, 'save')));
    expect(after - before).toBe(1);
    expect((await tenant.get('/v1/favorites/ids')).body).toContain(ids[0]);
    expect((await tenant.get('/v1/favorites')).body.some((f: { id: string }) => f.id === ids[0])).toBe(true);
    expect((await tenant.delete(`/v1/favorites/${ids[0]}`)).status).toBe(200);
    expect((await tenant.get('/v1/favorites/ids')).body).not.toContain(ids[0]);
    expect((await ctx.http().post('/v1/favorites').send({ listingId: ids[0] })).status).toBe(401);

    expect((await tenant.post('/v1/compare').send({ listingIds: ids })).status).toBe(422);
    const cmp = await tenant.post('/v1/compare').send({ name: 'ტესტ შედარება', listingIds: ids.slice(0, 3) });
    expect(cmp.status).toBe(201);
    const upd = await tenant.patch(`/v1/compare/${cmp.body.id}`).send({ listingIds: ids.slice(0, 6) });
    expect(upd.body.listingIds).toHaveLength(6);
    const shared = await ctx.http().get(`/v1/compare/shared/${cmp.body.shareToken}`);
    expect(shared.status).toBe(200);
    expect(shared.body.listings).toHaveLength(6);
    expect(shared.body.listings[0].passportFull).toBeTruthy();
    // read-only: anonymous and other users cannot modify
    expect((await ctx.http().patch(`/v1/compare/${cmp.body.id}`).send({ name: 'x' })).status).toBe(401);
    const agent = await loginAs(ctx.app, PHONES.agent);
    expect((await agent.patch(`/v1/compare/${cmp.body.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await ctx.http().get('/v1/compare/shared/nope-token')).status).toBe(404);
  });

  it('P6: demand request expires by default after settings days, suggests matches, contact notifies + messages, expire job', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const districts = await ctx.http().get('/v1/taxonomy/districts').query({ city: 'tbilisi' });
    const vake = districts.body.find((d: { slug: string }) => d.slug === 'vake');
    const created = await tenant.post('/v1/demand').send({ businessType: 'cafe', title: 'ვეძებ კაფეს ფართს ვაკეში', areaMin: 30, areaMax: 300, budgetMinor: 1_000_000, districtIds: [vake.id] });
    expect(created.status).toBe(201);
    const days = (new Date(created.body.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(created.body.mine).toBe(true);

    const board = await ctx.http().get('/v1/demand').query({ businessType: 'cafe' });
    expect(board.body.items.some((d: { id: string }) => d.id === created.body.id)).toBe(true);
    expect(JSON.stringify(board.body)).not.toContain('contactPhone');

    const matches = await ctx.http().get(`/v1/demand/${created.body.id}/matches`);
    expect(matches.status).toBe(200);
    for (const l of matches.body.items) {
      expect(l.businessTypes).toContain('cafe');
      expect(l.districtSlug).toBe('vake');
      expect(l.areaM2).toBeGreaterThanOrEqual(30);
    }

    const owner = await loginAs(ctx.app, PHONES.owner);
    const contact = await owner.post(`/v1/demand/${created.body.id}/contact`).send({ body: 'გამარჯობა, მაქ შესაფერისი ფართი ვაკეში.' });
    expect(contact.status).toBe(200);
    const note = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, tenant.user.id), eq(notifications.template, 'demand_contact'), eq(notifications.channel, 'in_app')));
    expect(note.length).toBeGreaterThan(0);
    const msgs = await ctx.db.select().from(messages).where(eq(messages.conversationId, contact.body.conversationId));
    expect(msgs[0]!.body).toContain('მაქ შესაფერისი');
    expect((await tenant.post(`/v1/demand/${created.body.id}/contact`).send({ body: 'საკუთარ თავს' })).status).toBe(400);

    // others cannot close; requester can
    expect((await owner.post(`/v1/demand/${created.body.id}/close`)).status).toBe(403);
    expect((await tenant.post(`/v1/demand/${created.body.id}/close`)).status).toBe(200);
    expect((await ctx.http().get('/v1/demand').query({ businessType: 'cafe' })).body.items.some((d: { id: string }) => d.id === created.body.id)).toBe(false);

    // expire job
    const second = await tenant.post('/v1/demand').send({ businessType: 'office', title: 'ოფისი საბურთალოზე 5 წლით', expiresInDays: 1 });
    await ctx.db.update(demandRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(demandRequests.id, second.body.id));
    await ctx.queue.runNow('demand.expire');
    const [row] = await ctx.db.select().from(demandRequests).where(eq(demandRequests.id, second.body.id));
    expect(row!.status).toBe('expired');
  });

  it('P24: request-a-quote → quote → accept → complete records commission from settings → review', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const provider = await loginAs(ctx.app, PHONES.provider);
    const me = await provider.get('/v1/services/providers/me');
    expect(me.status).toBe(200);
    expect(me.body.slug).toBeTruthy();
    const slug = me.body.slug as string;

    const detail = await ctx.http().get(`/v1/services/providers/${slug}`);
    expect(detail.body.phone).toBeNull(); // hidden for guests
    const order = await tenant.post('/v1/services/orders').send({ providerId: me.body.id, category: me.body.categories[0], description: '80 მ² კაფეს სრული მოწყობა ტესტისთვის' });
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('requested');
    expect((await ctx.db.select().from(notifications).where(and(eq(notifications.userId, provider.user.id), eq(notifications.template, 'service_request')))).length).toBeGreaterThan(0);

    expect((await tenant.post(`/v1/services/orders/${order.body.id}/quote`).send({ quoteMinor: 100 })).status).toBe(403);
    expect((await tenant.post(`/v1/services/orders/${order.body.id}/accept`)).status).toBe(422);
    const quoted = await provider.post(`/v1/services/orders/${order.body.id}/quote`).send({ quoteMinor: 1_500_000, quoteNote: 'მასალით' });
    expect(quoted.body.status).toBe('quoted');
    expect((await tenant.get('/v1/services/orders')).body.find((o: { id: string }) => o.id === order.body.id).quoteMinor).toBe(1_500_000);
    expect((await tenant.post(`/v1/services/orders/${order.body.id}/accept`)).body.status).toBe('accepted');
    expect((await tenant.post(`/v1/services/orders/${order.body.id}/status`).send({ status: 'completed' })).status).toBe(403);
    expect((await provider.post(`/v1/services/orders/${order.body.id}/status`).send({ status: 'in_progress' })).body.status).toBe('in_progress');
    const done = await provider.post(`/v1/services/orders/${order.body.id}/status`).send({ status: 'completed' });
    expect(done.body.status).toBe('completed');
    const [row] = await ctx.db.select().from(serviceOrders).where(eq(serviceOrders.id, order.body.id));
    expect(row!.amountMinor).toBe(1_500_000);
    expect(row!.commissionMinor).toBe(Math.round((1_500_000 * row!.commissionPct) / 100));
    expect(row!.commissionPct).toBe(10);

    const providerView = await provider.get('/v1/services/orders').query({ role: 'provider' });
    expect(providerView.body.find((o: { id: string }) => o.id === order.body.id).commissionMinor).toBe(150_000);
    expect((await tenant.get('/v1/services/orders')).body.find((o: { id: string }) => o.id === order.body.id).canReview).toBe(true);

    const agent = await loginAs(ctx.app, PHONES.agent);
    expect((await agent.post(`/v1/services/providers/${slug}/reviews`).send({ rating: 5 })).status).toBe(403);
    const review = await tenant.post(`/v1/services/providers/${slug}/reviews`).send({ rating: 5, body: 'სუპერ' });
    expect(review.status).toBe(201);
    expect((await tenant.post(`/v1/services/providers/${slug}/reviews`).send({ rating: 4 })).status).toBe(409);
    const cats = await ctx.http().get('/v1/services/categories');
    expect(cats.body.length).toBeGreaterThan(3);
    const list = await ctx.http().get('/v1/services/providers').query({ category: me.body.categories[0] });
    expect(list.body.items.every((p: { categories: string[] }) => p.categories.includes(me.body.categories[0]))).toBe(true);
  });

  it('P8: projects list/detail with units; pre-booking stores request and notifies developer', async () => {
    const list = await ctx.http().get('/v1/projects');
    expect(list.status).toBe(200);
    const withUnits = list.body.find((p: { unitsCount: number }) => p.unitsCount > 0);
    expect(withUnits).toBeTruthy();
    const detail = await ctx.http().get(`/v1/projects/${withUnits.slug}`);
    expect(detail.body.units.length).toBe(withUnits.unitsCount);
    expect(detail.body.units.every((u: { offPlan: boolean }) => u.offPlan)).toBe(true);

    const tenant = await loginAs(ctx.app, PHONES.tenant);
    expect((await ctx.http().post(`/v1/projects/${withUnits.slug}/prebook`).send({})).status).toBe(401);
    const unit = detail.body.units.find((u: { status: string; id: string }) => u.status === 'active');
    await ctx.db.delete(prebookings).where(and(eq(prebookings.userId, tenant.user.id), eq(prebookings.listingId, unit.id)));
    const pre = await tenant.post(`/v1/listings/${unit.id}/prebook`).send({ message: 'მაინტერესებ პირველი ქანობი' });
    expect(pre.status).toBe(201);
    expect(pre.body.duplicate).toBe(false);
    expect((await tenant.post(`/v1/listings/${unit.id}/prebook`).send({})).body.duplicate).toBe(true);
    const rows = await ctx.db.select().from(prebookings).where(eq(prebookings.id, pre.body.id));
    expect(rows[0]!.projectId).toBe(detail.body.id);
    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.template, 'prebooking'), eq(notifications.channel, 'in_app')));
    expect(notes.length).toBeGreaterThan(0);
    expect((await tenant.get('/v1/projects/prebookings/mine')).body.some((p: { id: string }) => p.id === pre.body.id)).toBe(true);

    const nonProject = (await ctx.http().get('/v1/listings').query({ limit: 50 })).body.items.find((i: { offPlan: boolean }) => !i.offPlan);
    expect((await tenant.post(`/v1/listings/${nonProject.id}/prebook`).send({})).status).toBe(400);
    expect((await ctx.http().get('/v1/projects/nope')).status).toBe(404);
  });

  it('C12 + SEO: broker & agency profiles, reviews, landing data, stats, sitemap', async () => {
    const broker = await ctx.http().get('/v1/profiles/brokers/ana-javakhishvili');
    expect(broker.status).toBe(200);
    expect(broker.body.org.slug).toBe('city-spaces');
    expect(JSON.stringify(broker.body)).not.toContain('+9955');
    const agency = await ctx.http().get('/v1/profiles/agencies/city-spaces');
    expect(agency.status).toBe(200);
    expect(agency.body.team.length).toBeGreaterThan(0);
    expect((await ctx.http().get('/v1/profiles/brokers/nobody-here')).status).toBe(404);
    const reveal = await ctx.http().post('/v1/profiles/brokers/ana-javakhishvili/reveal-phone');
    expect(reveal.body.phone).toBe(PHONES.agent);

    const tenant = await loginAs(ctx.app, PHONES.tenant);
    expect((await tenant.post('/v1/profiles/brokers/ana-javakhishvili/reviews').send({ rating: 5, body: 'კარგი ბროკერი' })).status).toBe(201);
    expect((await tenant.post('/v1/profiles/brokers/ana-javakhishvili/reviews').send({ rating: 5 })).status).toBe(409);
    const agent = await loginAs(ctx.app, PHONES.agent);
    expect((await agent.post('/v1/profiles/agencies/city-spaces/reviews').send({ rating: 5 })).status).toBe(400);

    const landing = await ctx.http().get('/v1/seo/landing').query({ businessType: 'cafe' });
    expect(landing.status).toBe(200);
    expect(landing.body.total).toBeGreaterThan(0);
    expect(landing.body.related[0].kind).toBe('district');
    const search = await ctx.http().get('/v1/listings').query({ businessType: 'cafe', limit: 1 });
    expect(landing.body.total).toBe(search.body.total);
    const combo = await ctx.http().get('/v1/seo/landing').query({ businessType: 'cafe', district: 'vake' });
    expect(combo.status).toBe(200);
    expect(combo.body.listings.every((l: { districtSlug: string }) => l.districtSlug === 'vake')).toBe(true);
    expect((await ctx.http().get('/v1/seo/landing').query({ businessType: 'nope' })).status).toBe(404);

    const stats = await ctx.http().get('/v1/seo/stats');
    expect(stats.body.activeListings).toBeGreaterThan(0);
    const combos = await ctx.http().get('/v1/seo/combos');
    expect(combos.body.length).toBeGreaterThan(0);
    const sm = await ctx.http().get('/v1/seo/sitemap/listings').query({ page: 0, size: 5 });
    expect(sm.body.items).toHaveLength(5);
    expect(sm.body.total).toBeGreaterThan(5);
  });
});
