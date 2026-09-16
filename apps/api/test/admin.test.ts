import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, auditLog, businessTypes, cmsPages, eq, listings, notifications, organizations, ownerVerifications, sessions, users } from '@lokacia/db';
import { createApp, loginAs, PHONES } from './helpers';

describe('admin & moderation (Phase 4)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('non-moderators are forbidden; moderators see the dashboard', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    expect((await owner.get('/v1/admin/dashboard')).status).toBe(403);
    expect((await ctx.http().get('/v1/admin/dashboard')).status).toBe(401);
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const d = await mod.get('/v1/admin/dashboard');
    expect(d.status).toBe(200);
    expect(d.body.queues.moderation).toBeGreaterThan(0);
    expect(d.body.signupsByDay).toHaveLength(30);
    // admin-only endpoints
    expect((await mod.get('/v1/admin/revenue')).status).toBe(403);
    expect((await mod.patch('/v1/admin/settings').send({ liveness_interval_days: 10 })).status).toBe(403);
  });

  it('moderator processes the queue end to end; every action lands in audit_log (done-when)', async () => {
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const q = await mod.get('/v1/admin/moderation/listings').query({ limit: 5 });
    expect(q.status).toBe(200);
    expect(q.body.items.length).toBeGreaterThanOrEqual(3);
    const [first, second, third] = q.body.items as { id: string; owner: { id: string } }[];

    const detail = await mod.get(`/v1/admin/moderation/listings/${first!.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.listing.id).toBe(first!.id);
    expect(detail.body.owner.id).toBe(first!.owner.id);
    expect(detail.body.priceCheck).toHaveProperty('priceM2Minor');

    expect((await mod.post(`/v1/admin/moderation/listings/${first!.id}/approve`)).body.status).toBe('active');
    const rej = await mod.post(`/v1/admin/moderation/listings/${second!.id}/reject`).send({ reason: 'ფოტოები არ შეესაბამება ფართს' });
    expect(rej.body.status).toBe('rejected');
    const bulk = await mod.post('/v1/admin/moderation/listings/bulk').send({ ids: [third!.id], action: 'approve' });
    expect(bulk.body.ok).toBe(1);

    const l1 = await ctx.db.query.listings.findFirst({ where: eq(listings.id, first!.id) });
    expect(l1!.status).toBe('active');
    const l2 = await ctx.db.query.listings.findFirst({ where: eq(listings.id, second!.id) });
    expect(l2!.rejectReason).toContain('ფოტოები');
    const note = await ctx.db.query.notifications.findFirst({ where: and(eq(notifications.userId, l2!.ownerId), eq(notifications.template, 'listing_rejected')) });
    expect(note).toBeTruthy();

    await new Promise((r) => setTimeout(r, 100));
    const audit = await mod.get('/v1/admin/audit').query({ entityId: first!.id });
    expect(audit.body.items.some((a: { action: string }) => a.action.includes('approve'))).toBe(true);
    for (const id of [second!.id, third!.id]) {
      const rows = await ctx.db.select().from(auditLog).where(eq(auditLog.entity, 'admin'));
      expect(rows.some((r) => r.entityId === id || JSON.stringify(r.diff).includes(id))).toBe(true);
    }
  });

  it('owner verification approve sets verified_owner and notifies', async () => {
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const list = await mod.get('/v1/admin/verifications');
    expect(list.status).toBe(200);
    const v = list.body[0];
    expect(v.status).toBe('pending');
    const res = await mod.post(`/v1/admin/verifications/${v.id}/approve`);
    expect(res.body.status).toBe('approved');
    const l = await ctx.db.query.listings.findFirst({ where: eq(listings.id, v.listing.id) });
    expect(l!.verifiedOwner).toBe(true);
    expect((await mod.post(`/v1/admin/verifications/${v.id}/approve`)).status).toBe(409);
    const v2 = list.body[1];
    const rej = await mod.post(`/v1/admin/verifications/${v2.id}/reject`).send({ reason: 'ამონაწერი არ ემთხვევა მისამართს' });
    expect(rej.body.status).toBe('rejected');
    expect((await ctx.db.query.ownerVerifications.findFirst({ where: eq(ownerVerifications.id, v2.id) }))!.note).toContain('ამონაწერი');
  });

  it('users: search, ban revokes sessions and blocks login, unban; role change is admin-only', async () => {
    const target = await loginAs(ctx.app, PHONES.provider);
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const found = await mod.get('/v1/admin/users').query({ q: PHONES.provider.slice(4) });
    expect(found.body.items.map((u: { id: string }) => u.id)).toContain(target.user.id);
    expect((await mod.get(`/v1/admin/users/${target.user.id}`)).body.phone).toBe(PHONES.provider);

    expect((await mod.post(`/v1/admin/users/${target.user.id}/ban`).send({ reason: 'სპამი' })).status).toBe(200);
    const active = await ctx.db.select().from(sessions).where(eq(sessions.userId, target.user.id));
    expect(active.every((s) => s.revokedAt)).toBe(true);
    const relogin = await request(ctx.app.getHttpServer()).post('/v1/auth/otp/verify').send({ phone: PHONES.provider, code: '123456' });
    expect(relogin.status).toBe(403);
    expect((await mod.post(`/v1/admin/users/${target.user.id}/unban`)).body.bannedAt).toBeNull();

    expect((await mod.patch(`/v1/admin/users/${target.user.id}/role`).send({ role: 'broker' })).status).toBe(403);
    const admin = await loginAs(ctx.app, PHONES.admin);
    expect((await admin.patch(`/v1/admin/users/${target.user.id}/role`).send({ role: 'broker' })).body.role).toBe('broker');
    await admin.patch(`/v1/admin/users/${target.user.id}/role`).send({ role: 'user' });
  });

  it('impersonation: admin acts as user, audit shows the real actor, stop restores admin', async () => {
    const admin = await loginAs(ctx.app, PHONES.admin);
    const tenant = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.tenant) });
    const mod = await loginAs(ctx.app, PHONES.moderator);
    expect((await mod.post(`/v1/admin/users/${tenant!.id}/impersonate`)).status).toBe(403);

    const imp = await admin.post(`/v1/admin/users/${tenant!.id}/impersonate`);
    expect(imp.status).toBe(200);
    const me = await admin.get('/v1/auth/me');
    expect(me.body.id).toBe(tenant!.id);
    expect(me.body.impersonatorId).toBe(admin.user.id);

    // a mutation while impersonating is attributed to the admin
    const fb = await admin.post('/v1/finance/applications').send({ productId: (await ctx.http().get('/v1/finance/products')).body[0].id, amountMinor: 1_000_000, termMonths: 12, consent: true });
    expect(fb.status).toBe(201);
    await new Promise((r) => setTimeout(r, 100));
    const row = await ctx.db.query.auditLog.findFirst({ where: and(eq(auditLog.entity, 'finance'), eq(auditLog.impersonatorId, admin.user.id)) });
    expect(row!.actorId).toBe(admin.user.id);

    const stop = await admin.post('/v1/admin/impersonation/stop');
    expect(stop.status).toBe(200);
    expect(stop.body.redirectUrl).toContain(`/users/${tenant!.id}`);
    const back = await admin.get('/v1/auth/me');
    expect(back.body.id).toBe(admin.user.id);
    expect(back.body.impersonatorId).toBeNull();
  });

  it('orgs verify flag; settings & plan prices; promo toggle', async () => {
    const admin = await loginAs(ctx.app, PHONES.admin);
    const orgs = await admin.get('/v1/admin/orgs');
    const org = orgs.body.items[0];
    expect((await admin.patch(`/v1/admin/orgs/${org.id}`).send({ verified: true })).body.verified).toBe(true);
    expect((await ctx.db.query.organizations.findFirst({ where: eq(organizations.id, org.id) }))!.verified).toBe(true);
    expect((await admin.get(`/v1/admin/orgs/${org.id}`)).body.members.length).toBeGreaterThan(0);

    const s = await admin.patch('/v1/admin/settings').send({ liveness_interval_days: 14, launch_promo_until: null });
    expect(s.body.values.liveness_interval_days).toBe(14);
    expect(s.body.promoActive).toBe(false);
    expect((await ctx.http().get('/v1/billing/plans')).body.promoActive).toBe(false);
    const s2 = await admin.patch('/v1/admin/settings').send({ launch_promo_until: '2099-12-31' });
    expect(s2.body.promoActive).toBe(true);

    const plan = await admin.patch('/v1/admin/plans/vip_7').send({ priceMinor: 1900 });
    expect(plan.body.priceMinor).toBe(1900);
    expect((await ctx.http().get('/v1/billing/plans')).body.plans.find((p: { key: string }) => p.key === 'vip_7').priceMinor).toBe(1900);
    await admin.patch('/v1/admin/plans/vip_7').send({ priceMinor: 1500 });
    await admin.patch('/v1/admin/settings').send({ launch_promo_until: null, liveness_interval_days: 12 });
  });

  it('CMS permits page CRUD is visible through the public taxonomy endpoint', async () => {
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const bt = await ctx.db.query.businessTypes.findFirst({ where: eq(businessTypes.slug, 'bakery') });
    const created = await mod.post('/v1/admin/cms').send({ kind: 'permits', slug: 'test-permits-page', businessTypeId: bt!.id, title: 'ტესტ ჩეკლისტი', bodyMd: '# ნებართვები\n\n- [ ] რეგისტრაცია' });
    expect(created.status).toBe(201);
    expect((await ctx.http().get('/v1/taxonomy/permits/test-permits-page')).body.title).toBe('ტესტ ჩეკლისტი');
    await mod.patch(`/v1/admin/cms/${created.body.id}`).send({ title: 'ტესტ ჩეკლისტი 2' });
    expect((await ctx.http().get('/v1/taxonomy/permits/test-permits-page')).body.title).toBe('ტესტ ჩეკლისტი 2');
    expect((await mod.post('/v1/admin/cms').send({ kind: 'permits', slug: 'test-permits-page', title: 'x', bodyMd: 'y' })).status).toBe(409);
    await mod.delete(`/v1/admin/cms/${created.body.id}`);
    expect((await ctx.http().get('/v1/taxonomy/permits/test-permits-page')).status).toBe(404);
    expect((await ctx.db.query.cmsPages.findFirst({ where: eq(cmsPages.id, created.body.id) }))!.deletedAt).toBeTruthy();
  });

  it('taxonomy editor updates business types and invalidates cache; district override', async () => {
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const bts = await mod.get('/v1/admin/business-types');
    const cafe = bts.body.find((b: { slug: string }) => b.slug === 'cafe');
    await ctx.http().get('/v1/taxonomy/business-types'); // warm cache
    const res = await mod.patch(`/v1/admin/business-types/${cafe.id}`).send({ utilityCoef: 9.5, filterConfig: { ...cafe.filterConfig, required: ['powerKw', 'hasHood'] } });
    expect(res.status).toBe(200);
    const pub = await ctx.http().get('/v1/taxonomy/business-types/cafe');
    expect(pub.body.utilityCoef).toBe(9.5);
    expect(pub.body.filterConfig.required).toEqual(['powerKw', 'hasHood']);

    const created = await mod.post('/v1/admin/business-types').send({ slug: 'test-kiosk', nameKa: 'ჯიხური', nameEn: 'Kiosk', nameRu: 'Киоск', icon: 'store', utilityCoef: 2, fitoutPerM2Minor: 10000, filterConfig: { filters: [{ key: 'powerKw', kind: 'min', labelKa: 'სიმძლავრე', unit: 'კვტ' }], required: [] } });
    expect(created.status).toBe(201);
    expect((await ctx.http().get('/v1/taxonomy/business-types/test-kiosk')).status).toBe(200);

    const ds = await mod.get('/v1/admin/districts').query({ city: 'batumi' });
    expect(ds.body.length).toBeGreaterThan(0);
    const d = await mod.patch(`/v1/admin/districts/${ds.body[0].id}`).send({ avgPriceM2OverrideMinor: 4200 });
    expect(d.body.avgPriceM2Minor).toBe(4200);
    expect(d.body.avgPriceM2OverrideMinor).toBe(4200);
  });

  it('feedback widget + analytics events are public, rate limited, and reach the inbox', async () => {
    const res = await ctx.http().post('/v1/feedback').send({ message: 'ძებნის ფილტრი ძალიან მოსწონა', rating: 5, path: '/search' });
    expect(res.status).toBe(201);
    expect((await ctx.http().post('/v1/feedback').send({ message: 'x' })).status).toBe(422);
    const ev = await ctx.http().post('/v1/analytics/events').send({ name: 'page_view', path: '/search?q=phone', props: { ref: 'home' } });
    expect(ev.status).toBe(204);
    expect(ev.headers['set-cookie']).toBeUndefined();
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const inbox = await mod.get('/v1/admin/feedback').query({ status: 'new' });
    const item = inbox.body.find((f: { id: string }) => f.id === res.body.id);
    expect(item.rating).toBe(5);
    expect((await mod.patch(`/v1/admin/feedback/${item.id}`).send({ status: 'done' })).body.status).toBe('done');
    for (let i = 0; i < 6; i++) await ctx.http().post('/v1/feedback').send({ message: 'სპამის ტესტი ' + i });
    expect((await ctx.http().post('/v1/feedback').send({ message: 'სპამის ტესტი ბოლო' })).status).toBe(429);
  });

  it('revenue view for admin', async () => {
    const admin = await loginAs(ctx.app, PHONES.admin);
    const r = await admin.get('/v1/admin/revenue');
    expect(r.status).toBe(200);
    expect(r.body.mrrMinor).toBeGreaterThan(0);
    expect(r.body.byMonth).toHaveLength(12);
    expect(r.body.failedPayments.length).toBeGreaterThan(0);
  });
});
