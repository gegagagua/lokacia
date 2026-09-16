import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, loginAs, PHONES } from './helpers';

const cafe = {
  businessTypes: ['cafe'],
  dealType: 'rent',
  title: 'ტესტ კაფე ვაკეში ვიტრინით',
  description: 'ტესტ აღწერა',
  address: 'თბილისი, ჭავჭავაძის პრ. 1',
  lat: 41.7085,
  lng: 44.752,
  areaM2: 60,
  priceMinor: 300000,
  passport: { powerKw: 25, ceilingM: 3.4, hasHood: true, hasGas: true, wetPoints: 2, widthM: 6, depthM: 10 },
  history: [
    { businessName: 'A', startedAt: '2023-01-01', endedAt: '2023-12-01' },
    { businessName: 'B', startedAt: '2024-01-01', endedAt: '2024-10-01' },
    { businessName: 'C', startedAt: '2024-11-01', endedAt: '2025-12-01' },
  ],
};

describe('listings lifecycle', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('owner publishes → moderator approves → appears in search (Phase 3 done-when)', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const created = await owner.post('/v1/listings').send({ ...cafe, submit: true });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending_review');
    expect(created.body.districtId).toBeTruthy();
    expect(created.body.closuresWarning).toBe(true);

    // not public yet
    expect((await ctx.http().get(`/v1/listings/${created.body.slug}`)).status).toBe(404);

    // owner cannot self-approve
    expect((await owner.post(`/v1/listings/${created.body.id}/status`).send({ status: 'active' })).status).toBe(403);

    const mod = await loginAs(ctx.app, PHONES.moderator);
    const approved = await mod.post(`/v1/listings/${created.body.id}/status`).send({ status: 'active' });
    expect(approved.status).toBe(200);
    expect(approved.body.lastConfirmedAt).toBeTruthy();

    const page = await ctx.http().get(`/v1/listings/${created.body.slug}`);
    expect(page.status).toBe(200);
    expect(page.body.passport.hasHood).toBe(true);

    const search = await ctx.http().get('/v1/listings').query({ q: 'ტესტ კაფე', businessType: 'cafe', hasHood: 'true', districts: 'vake' });
    expect(search.body.items.map((i: { id: string }) => i.id)).toContain(created.body.id);
  });

  it('rejects submission with incomplete passport for the business type', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const res = await owner.post('/v1/listings').send({ ...cafe, passport: { powerKw: 10 }, submit: true });
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toContain('passport.hasHood');
  });

  it('enforces lifecycle transitions', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const draft = await owner.post('/v1/listings').send(cafe);
    expect(draft.body.status).toBe('draft');
    const bad = await owner.post(`/v1/listings/${draft.body.id}/status`).send({ status: 'rented' });
    expect(bad.status).toBe(422);
  });

  it('reveals phone, logs it, and rate-limits', async () => {
    const list = await ctx.http().get('/v1/listings').query({ limit: 1 });
    const id = list.body.items[0].id;
    const r = await ctx.http().post(`/v1/listings/${id}/reveal-phone`).set('x-forwarded-for', '10.9.9.9');
    expect(r.status).toBe(200);
    expect(r.body.phone).toMatch(/^\+995/);
    let status = 200;
    for (let i = 0; i < 25; i++) status = (await ctx.http().post(`/v1/listings/${id}/reveal-phone`).set('x-forwarded-for', '10.9.9.10')).status;
    expect(status).toBe(429);
  });

  it('non-members cannot edit a listing', async () => {
    const list = await ctx.http().get('/v1/listings').query({ limit: 1, onlyOwners: 'true' });
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const res = await tenant.patch(`/v1/listings/${list.body.items[0].id}`).send({ title: 'hijack attempt title' });
    expect(res.status).toBe(403);
  });

  it('partial update keeps history intact', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const draft = await owner.post('/v1/listings').send(cafe);
    const upd = await owner.patch(`/v1/listings/${draft.body.id}`).send({ priceMinor: 280000 });
    expect(upd.body.priceMinor).toBe(280000);
    expect(upd.body.history).toHaveLength(3);
  });
});

describe('search & geo', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('filters by business-type passport fields, price and cursor pagination', async () => {
    const r = await ctx.http().get('/v1/listings').query({ dealType: 'rent', priceMax: 5000, ceilingM: 3, limit: 5 });
    expect(r.status).toBe(200);
    for (const i of r.body.items) expect(i.priceMinor).toBeLessThanOrEqual(500000);
    if (r.body.nextCursor) {
      const p2 = await ctx.http().get('/v1/listings').query({ dealType: 'rent', priceMax: 5000, ceilingM: 3, limit: 5, cursor: r.body.nextCursor });
      expect(p2.body.items[0]?.id).not.toBe(r.body.items[0].id);
    }
  });

  it('only-owners filter', async () => {
    const r = await ctx.http().get('/v1/listings').query({ onlyOwners: 'true', limit: 50 });
    expect(r.body.items.every((i: { isOwner: boolean }) => i.isOwner)).toBe(true);
  });

  it('returns location insights with counts', async () => {
    const r = await ctx.http().get('/v1/geo/insights').query({ lat: 41.7085, lng: 44.752, businessType: 'cafe', priceMinor: 300000, areaM2: 60, radiusM: 1500 });
    expect(r.status).toBe(200);
    expect(r.body.categories).toHaveLength(6);
    expect(r.body.district.slug).toBeTruthy();
  });

  it('parses natural-language queries with the rule fallback', async () => {
    const r = await ctx.http().post('/v1/search/parse').send({ text: '50 მ² კაფესთვის ვაკეში, 3000 ლარამდე' });
    expect(r.body.filters).toMatchObject({ businessType: 'cafe', districts: ['vake'], priceMax: 3000 });
  });
});
