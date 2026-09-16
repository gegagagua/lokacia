import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, auditLog, demandRequests, eq, isNotNull, leases, listings, projects, reviews, sessions, users } from '@lokacia/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersController } from '../src/modules/users/users.controller';
import { sniffUpload } from '../src/modules/media/media.service';
import { createApp, loginAs, PHONES } from './helpers';

const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)"></svg>');
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');

/** Security review 2026-09: API-wide regression tests (CSRF, media, messaging, auth, privacy, abuse limits). */
describe('security: API sweep', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    ctx = await createApp();
  });
  afterAll(async () => ctx.app.close());

  it('CSRF: form-encoded / text/plain mutations are refused, JSON and empty bodies pass', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const listing = await ctx.db.query.listings.findFirst({ where: eq(listings.status, 'active') });
    const form = await tenant.post('/v1/favorites').set('content-type', 'application/x-www-form-urlencoded').send(`listingId=${listing!.id}`);
    expect(form.status).toBe(415);
    expect(form.headers['content-type']).toContain('application/problem+json');
    expect((await tenant.post('/v1/favorites').set('content-type', 'text/plain').send(JSON.stringify({ listingId: listing!.id }))).status).toBe(415);
    expect((await tenant.post('/v1/favorites').set('content-type', 'multipart/form-data; boundary=x').send('--x--')).status).toBe(415);
    expect([200, 201]).toContain((await tenant.post('/v1/favorites').send({ listingId: listing!.id })).status);
    expect((await tenant.post('/v1/auth/logout')).status).toBeLessThan(400);
  });

  it('media: private storage keys are not served; SVG/markup uploads refused; served files are sandboxed', async () => {
    for (const key of ['contracts/00000000-0000-0000-0000-000000000000.pdf', 'reports/00000000-0000-0000-0000-000000000000.pdf', 'uploads/../contracts/x.pdf', 'imports/x.csv']) {
      expect((await ctx.http().get(`/v1/media/files/${key}`)).status).toBeGreaterThanOrEqual(400);
    }
    expect(sniffUpload(SVG, 'image/png').ok).toBe(false);
    expect(sniffUpload(SVG, 'application/octet-stream').ok).toBe(false);
    expect(sniffUpload(Buffer.from('<html><script>alert(1)</script>'), 'application/pdf').ok).toBe(false);
    expect(sniffUpload(PNG_1PX, 'image/png').ok).toBe(true);

    const owner = await loginAs(ctx.app, PHONES.owner);
    const svg = await owner.post('/v1/media/uploads').send({ kind: 'document', contentType: 'image/png', fileName: 'evil.svg', size: SVG.length });
    expect(svg.status).toBe(201);
    expect(svg.body.key).toMatch(/original\.bin$/); // client extension is not trusted
    const put = await ctx.http().put(svg.body.uploadUrl.replace(/^\/api/, '')).set('content-type', 'image/png').send(SVG);
    expect(put.status).toBe(415);

    const ok = await owner.post('/v1/media/uploads').send({ kind: 'photo', contentType: 'image/png', fileName: 'p.png', size: PNG_1PX.length });
    const put2 = await ctx.http().put(ok.body.uploadUrl.replace(/^\/api/, '')).set('content-type', 'image/png').send(PNG_1PX);
    expect(put2.status).toBe(200);
    // a signed upload URL cannot overwrite the file once received
    expect((await ctx.http().put(ok.body.uploadUrl.replace(/^\/api/, '')).set('content-type', 'image/png').send(PNG_1PX)).status).toBeGreaterThanOrEqual(400);
    await ctx.queue.drain();
    const file = await ctx.http().get(`/v1/media/files/${ok.body.key.replace(/original\.png$/, 'sm.webp')}`);
    expect(file.status).toBe(200);
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toContain('sandbox');
  });

  it('messaging: direct messages only to counterparts, attachments only own media, send is rate-limited', async () => {
    const agent2 = await loginAs(ctx.app, PHONES.agency2Manager);
    const developer = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.developer) });
    const cold = await agent2.post('/v1/conversations/with-user').send({ userId: developer!.id, body: 'სპამი' });
    expect(cold.status).toBe(403);

    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const listing = await ctx.db.query.listings.findFirst({ where: and(eq(listings.status, 'active'), isNotNull(listings.ownerId)) });
    const start = await tenant.post('/v1/conversations').send({ listingId: listing!.id, body: 'გამარჯობა' });
    expect(start.status).toBe(201);
    const conv = start.body.conversationId;
    const phishing = await tenant.post(`/v1/conversations/${conv}/messages`).send({ body: 'ხელშეკრულება', attachments: [{ url: 'https://evil.example/contract.pdf', name: 'contract.pdf', type: 'application/pdf' }] });
    expect(phishing.status).toBe(400);
    let limited = false;
    for (let i = 0; i < 35 && !limited; i++) {
      const r = await tenant.post(`/v1/conversations/${conv}/messages`).send({ body: `msg ${i}` });
      if (r.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });

  it('auth: concurrent refresh with one token yields a single session; JWT alg pinned', async () => {
    const login = await ctx.http().post('/v1/auth/otp/verify').send({ phone: PHONES.developer, code: '123456' });
    const rt = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('lk_rt='))!.split(';')[0]!;
    const results = await Promise.all([1, 2, 3].map(() => ctx.http().post('/v1/auth/refresh').set('Cookie', rt)));
    expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
    // unsigned token (alg=none) is rejected
    const [h, p] = String((login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('lk_at='))!.split(';')[0]!.slice(6)).split('.');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${p}.`;
    void h;
    expect((await ctx.http().get('/v1/auth/me').set('authorization', `Bearer ${none}`)).status).toBe(401);
  });

  it('impersonation: never of staff, short-lived, and blocked for money/API-key/account actions', async () => {
    const admin = await loginAs(ctx.app, PHONES.admin);
    const mod = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.moderator) });
    expect((await admin.post(`/v1/admin/users/${mod!.id}/impersonate`)).status).toBe(403);
    const tenant = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.tenant) });
    expect((await admin.post(`/v1/admin/users/${tenant!.id}/impersonate`)).status).toBe(200);
    const s = await ctx.db.query.sessions.findFirst({ where: and(eq(sessions.userId, tenant!.id), eq(sessions.impersonatorId, admin.user.id)), orderBy: (x, { desc }) => desc(x.createdAt) });
    expect(s!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600_000 + 5_000);
    expect((await admin.post('/v1/api-keys').send({ name: 'x', scopes: ['districts:read'] })).status).toBe(403);
    expect((await admin.post('/v1/billing/checkout').send({ planKey: 'owner' })).status).toBe(403);
    expect((await admin.get('/v1/users/me/export')).status).toBe(403);
    expect((await admin.delete('/v1/users/me')).status).toBe(403);
    await admin.post('/v1/admin/impersonation/stop');

    const moderator = await loginAs(ctx.app, PHONES.moderator);
    const adminRow = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.admin) });
    expect((await moderator.post(`/v1/admin/users/${adminRow!.id}/unban`)).status).toBe(403);
  });

  it('google login: no auto-link by e-mail, unverified e-mail not stored, banned users refused', async () => {
    const auth = ctx.app.get(AuthService);
    const owner = await ctx.db.query.users.findFirst({ where: eq(users.phone, PHONES.owner) });
    await ctx.db.update(users).set({ email: 'victim@example.com' }).where(eq(users.id, owner!.id));
    await expect(auth.resolveGoogleUser({ sub: `g-${Date.now()}`, email: 'victim@example.com', email_verified: 'true' })).rejects.toMatchObject({ status: 409 });
    const fresh = await auth.resolveGoogleUser({ sub: `g2-${Date.now()}`, email: 'someone@example.com', email_verified: 'false' });
    expect(fresh.email).toBeNull();
    await ctx.db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, fresh.id));
    await expect(auth.resolveGoogleUser({ sub: fresh.googleId! })).rejects.toMatchObject({ status: 403 });
  });

  it('privacy: export has no secrets and covers counterpart data; delete anonymizes demand, reviews, leases', async () => {
    const phone = '+995599123456';
    const u = await loginAs(ctx.app, phone);
    await ctx.db.update(users).set({ telegramLinkToken: 'secret-link-token' }).where(eq(users.id, u.user.id));
    const exp = await u.get('/v1/users/me/export');
    expect(exp.status).toBe(200);
    expect(JSON.stringify(exp.body)).not.toContain('secret-link-token');
    expect(exp.body).toHaveProperty('conversations');
    expect(exp.body).toHaveProperty('leases');

    const district = await ctx.db.query.districts.findFirst();
    const [demand] = await ctx.db.insert(demandRequests).values({ userId: u.user.id, businessType: 'cafe', dealType: 'rent', title: 'კაფე ვაკეში', districtIds: [district!.id], contactPhone: phone, expiresAt: new Date(Date.now() + 86_400_000) } as typeof demandRequests.$inferInsert).returning();
    const listing = await ctx.db.query.listings.findFirst({ where: eq(listings.status, 'active') });
    const [review] = await ctx.db.insert(reviews).values({ targetType: 'broker', targetId: listing!.ownerId, authorId: u.user.id, authorName: 'გიორგი ბ.', rating: 5 } as typeof reviews.$inferInsert).returning();
    const [lease] = await ctx.db.insert(leases).values({ listingId: listing!.id, ownerId: listing!.ownerId, tenantId: u.user.id, tenantName: 'გიორგი ბერიძე', tenantPhone: phone, rentMinor: 100000, dayOfMonth: 1, startsOn: '2026-01-01' } as typeof leases.$inferInsert).returning();

    expect((await u.delete('/v1/users/me')).status).toBe(200);
    const d = await ctx.db.query.demandRequests.findFirst({ where: eq(demandRequests.id, demand!.id) });
    expect(d!.contactPhone).toBeNull();
    expect(d!.status).toBe('closed');
    expect((await ctx.db.query.reviews.findFirst({ where: eq(reviews.id, review!.id) }))!.authorName).toBe('წაშლილი მომხმარებელი');
    const l = await ctx.db.query.leases.findFirst({ where: eq(leases.id, lease!.id) });
    expect(l!.tenantPhone).toBeNull();
    expect(l!.tenantName).not.toContain('ბერიძე');
    const row = await ctx.db.query.users.findFirst({ where: eq(users.id, u.user.id) });
    expect(row!.phone).toBeNull();
    expect(row!.deletedAt).toBeTruthy();
  });

  it('telegram webhook requires the configured secret', async () => {
    const ctrl = ctx.app.get(UsersController) as unknown as { env: { TELEGRAM_WEBHOOK_SECRET: string } };
    const env = ctrl.env;
    ctrl.env = { ...env, TELEGRAM_WEBHOOK_SECRET: 'tg-secret-123' };
    try {
      const body = { message: { chat: { id: 1 }, text: '/start nothing' } };
      expect((await ctx.http().post('/v1/users/telegram/webhook').send(body)).status).toBe(403);
      expect((await ctx.http().post('/v1/users/telegram/webhook').set('x-telegram-bot-api-secret-token', 'wrong').send(body)).status).toBe(403);
      expect((await ctx.http().post('/v1/users/telegram/webhook').set('x-telegram-bot-api-secret-token', 'tg-secret-123').send(body)).status).toBe(200);
    } finally {
      ctrl.env = env;
    }
  });

  it('public score: unknown business types and non-public listings refused (no AI cost amplification)', async () => {
    const listing = await ctx.db.query.listings.findFirst({ where: eq(listings.status, 'active') });
    expect((await ctx.http().get(`/v1/v2/listings/${listing!.id}/score`).query({ businessType: `x${Date.now()}` })).status).toBe(400);
    const draft = await ctx.db.query.listings.findFirst({ where: eq(listings.status, 'draft') });
    if (draft) expect((await ctx.http().get(`/v1/v2/listings/${draft.id}/score`)).status).toBe(404);
  });

  it('broker phone reveal is logged; listings cannot join a foreign project', async () => {
    const broker = await ctx.db.query.users.findFirst({ where: and(isNotNull(users.slug), isNotNull(users.phone)) });
    const r = await ctx.http().post(`/v1/profiles/brokers/${broker!.slug}/reveal-phone`);
    if (r.status === 200) {
      const log = await ctx.db.query.auditLog.findFirst({ where: and(eq(auditLog.action, 'reveal_phone'), eq(auditLog.entityId, broker!.id)) });
      expect(log).toBeTruthy();
    }
    const owner = await loginAs(ctx.app, PHONES.owner);
    const mine = await ctx.db.query.listings.findFirst({ where: and(eq(listings.ownerId, owner.user.id), eq(listings.status, 'active')) });
    const foreign = await ctx.db.query.projects.findFirst({ where: isNotNull(projects.orgId) });
    if (foreign) expect((await owner.patch(`/v1/listings/${mine!.id}`).send({ projectId: foreign.id })).status).toBe(403);
  });
});
