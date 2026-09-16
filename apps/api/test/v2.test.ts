import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, apiUsage, eq, escrowAccounts, financeApplications, leases, ledgerEntries, listings, locationScores, offers, rentInvoices, scans, spacePassports, sql, trafficSamples } from '@lokacia/db';
import { SettingsService } from '../src/common/settings.service';
import { EscrowService } from '../src/modules/v2/escrow/escrow.service';
import { PropertyService } from '../src/modules/v2/property/property.service';
import { DEMO_OUTLINE, roomGlb } from '../src/modules/v2/insights/glb';
import { createApp, loginAs, PHONES } from './helpers';

const DEMO_KEY = 'lk_demo_analytics_key_123456';

describe('v2 (Phases 16–20, 22–24)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    ctx = await createApp();
    await ctx.app.get(SettingsService).set('launch_promo_until', '2099-01-01'); // promo must never apply to rent/escrow
  });
  afterAll(async () => ctx.app.close());

  const payMock = async (agent: Awaited<ReturnType<typeof loginAs>>, paymentId: string) => {
    const r = await agent.post(`/v1/billing/payments/${paymentId}/mock-complete`).send({ outcome: 'succeeded' });
    expect(r.body.status).toBe('succeeded');
    await ctx.queue.drain();
  };

  it('V1 traffic from samples, provider fallback with ingestion; V2 score computed and explained', async () => {
    const withSamples = await ctx.db.select({ id: trafficSamples.listingId }).from(trafficSamples).limit(1);
    const t = await ctx.http().get(`/v1/v2/listings/${withSamples[0]!.id}/traffic`);
    expect(t.status).toBe(200);
    expect(t.body.source).toBe('samples');
    expect(t.body.days).toHaveLength(7);
    expect(t.body.days[1].hours).toHaveLength(24);
    expect(t.body.peak.count).toBeGreaterThan(0);

    const bare = await ctx.db.execute<{ id: string; slug: string }>(sql`SELECT l.id, l.slug FROM listings l WHERE l.status = 'active' AND l.lat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM traffic_samples t WHERE t.listing_id = l.id) LIMIT 1`);
    const t2 = await ctx.http().get(`/v1/v2/listings/${bare[0]!.slug}/traffic`);
    expect(t2.body.source).toBe('provider');
    expect((await ctx.db.select().from(trafficSamples).where(eq(trafficSamples.listingId, bare[0]!.id))).length).toBe(168);

    await ctx.db.delete(locationScores).where(eq(locationScores.listingId, bare[0]!.id));
    const s = await ctx.http().get(`/v1/v2/listings/${bare[0]!.id}/score`);
    expect(s.status).toBe(200);
    expect(s.body.score).toBeGreaterThanOrEqual(0);
    expect(s.body.score).toBeLessThanOrEqual(100);
    expect(s.body.components.map((c: { key: string }) => c.key)).toEqual(['traffic', 'competition', 'price', 'transport', 'passport']);
    expect(s.body.components.reduce((a: number, c: { weight: number }) => a + c.weight, 0)).toBeCloseTo(1);
    expect(s.body.summary).toContain('ქულა');
    const l = await ctx.db.query.listings.findFirst({ where: eq(listings.id, bare[0]!.id) });
    expect(l!.locationScore).toBe(s.body.score);
  });

  it('V5 scan upload → floor plan from GLB → passport outline; demo GLB served', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const listing = await ctx.db.query.listings.findFirst({ where: and(eq(listings.ownerId, owner.user.id), eq(listings.status, 'active')) });
    const glb = roomGlb(DEMO_OUTLINE);
    const up = await owner.post('/v1/media/uploads').send({ kind: 'document', contentType: 'model/gltf-binary', fileName: 'room.glb', listingId: listing!.id, size: glb.length });
    expect(up.status).toBe(201);
    const put = await ctx.http().put(up.body.uploadUrl.replace(/^\/api/, '')).set('content-type', 'model/gltf-binary').send(glb);
    expect(put.status).toBeLessThan(300);
    const scan = await owner.post(`/v1/v2/listings/${listing!.id}/scans`).send({ mediaId: up.body.id });
    expect(scan.status).toBe(201);
    expect(scan.body.format).toBe('glb');
    await ctx.queue.drain();
    const row = await ctx.db.query.scans.findFirst({ where: eq(scans.id, scan.body.id) });
    expect(row!.status).toBe('ready');
    expect(row!.plan!.widthM).toBeCloseTo(9.2);
    expect(row!.plan!.outline).toHaveLength(6);
    const passport = await ctx.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, listing!.id) });
    expect(passport!.outline).toHaveLength(6);
    expect((await ctx.http().get(`/v1/v2/listings/${listing!.id}/scans`)).body.some((s: { id: string }) => s.id === scan.body.id)).toBe(true);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    expect((await tenant.post(`/v1/v2/listings/${listing!.id}/scans`).send({ mediaId: up.body.id })).status).toBe(403);
    const demo = await ctx.http().get('/v1/v2/scans/demo/room.glb');
    expect(demo.headers['content-type']).toContain('model/gltf-binary');
  });

  it('V3 escrow: contract signing → fund via PSP (no promo) → dispute → admin resolves; ledger balanced', async () => {
    const offer = await ctx.db.query.offers.findFirst({ where: eq(offers.status, 'accepted') });
    await ctx.db.delete(escrowAccounts).where(eq(escrowAccounts.offerId, offer!.id));
    const listing = await ctx.db.query.listings.findFirst({ where: eq(listings.id, offer!.listingId) });
    const ownerPhone = (await ctx.db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, listing!.ownerId) }))!.phone!;
    const tenantId = offer!.fromUserId === listing!.ownerId ? offer!.toUserId : offer!.fromUserId;
    const tenantPhone = (await ctx.db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, tenantId) }))!.phone!;
    const owner = await loginAs(ctx.app, ownerPhone);
    const tenant = await loginAs(ctx.app, tenantPhone);

    const created = await tenant.post('/v1/escrow').send({ offerId: offer!.id });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending');
    expect(created.body.myRole).toBe('tenant');
    const id = created.body.id;
    expect((await tenant.post(`/v1/escrow/${id}/fund`)).status).toBe(409); // not signed yet
    const pdf = await owner.get(`/v1/escrow/${id}/contract.pdf`);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    await tenant.post(`/v1/escrow/${id}/sign`);
    expect((await owner.post(`/v1/escrow/${id}/sign`)).body.ownerSignedAt).toBeTruthy();

    const fund = await tenant.post(`/v1/escrow/${id}/fund`);
    expect(fund.body.status).toBe('redirect');
    expect(fund.body.promo).toBe(false);
    expect(fund.body.amountMinor).toBe(created.body.amountMinor);
    await payMock(tenant, fund.body.paymentId);
    expect((await tenant.get(`/v1/escrow/${id}`)).body.status).toBe('funded');

    expect((await owner.post(`/v1/escrow/${id}/release`)).status).toBe(403); // only tenant releases
    const disputed = await owner.post(`/v1/escrow/${id}/dispute`).send({ reason: 'ფართი არ გადაეცა შეთანხმებულ დღეს' });
    expect(disputed.body.status).toBe('disputed');

    const mod = await loginAs(ctx.app, PHONES.moderator);
    expect((await mod.get('/v1/admin/escrow').query({ status: 'disputed' })).body.some((e: { id: string }) => e.id === id)).toBe(true);
    const resolved = await mod.post(`/v1/admin/escrow/${id}/resolve`).send({ outcome: 'refund', note: 'მესაკუთრემ არ გადასცა ფართი' });
    expect(resolved.body.status).toBe('refunded');
    expect((await mod.post(`/v1/admin/escrow/${id}/resolve`).send({ outcome: 'release', note: 'ხელახლა' })).status).toBe(409);

    const entries = await ctx.db.select().from(ledgerEntries).where(eq(ledgerEntries.refId, id));
    expect(entries.length).toBe(4);
    expect(entries.reduce((a, e) => a + e.debitMinor, 0)).toBe(entries.reduce((a, e) => a + e.creditMinor, 0));
    const rec = await ctx.app.get(EscrowService).reconcile();
    expect(rec.unbalanced).toHaveLength(0);
    expect((await mod.get('/v1/admin/ledger/reconcile')).body.checkedTx).toBeGreaterThan(0);
  });

  it('V4 rent: monthly generation, late penalty + notice, tenant pays via checkout, receipt, export, autopay', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const ov = await owner.get('/v1/property/overview');
    expect(ov.status).toBe(200);
    expect(ov.body.leases.length).toBeGreaterThanOrEqual(2);
    expect(ov.body.totals.overdueMinor).toBeGreaterThan(0);
    const tenantLease = (await tenant.get('/v1/property/overview')).body.leases[0];
    expect(tenantLease.myRole).toBe('tenant');

    const listing = await ctx.db.query.listings.findFirst({ where: and(eq(listings.ownerId, owner.user.id), eq(listings.status, 'active')) });
    const start = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
    const created = await owner.post('/v1/property/leases').send({ listingId: listing!.id, tenantName: 'შპს ტესტ', tenantPhone: PHONES.tenant, rentMinor: 250000, dayOfMonth: 1, startsOn: start, penaltyPctPerDay: 0.5 });
    expect(created.status).toBe(201);
    expect(created.body.tenantUserId).toBe(tenant.user.id);
    const leaseId = created.body.id;
    const svc = ctx.app.get(PropertyService);
    expect((await svc.generateInvoices()).created).toBe(0); // idempotent (created on lease creation)

    // make the invoice 4 days late
    const inv = await ctx.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.leaseId, leaseId) });
    const due = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
    await ctx.db.update(rentInvoices).set({ dueOn: due }).where(eq(rentInvoices.id, inv!.id));
    await svc.lateNotices();
    const late = await ctx.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.id, inv!.id) });
    expect(late!.status).toBe('overdue');
    expect(late!.penaltyMinor).toBe(Math.round(250000 * 0.005 * 4));
    expect(late!.lateNoticeSentAt).toBeTruthy();

    const other = await loginAs(ctx.app, PHONES.agent);
    expect((await other.get(`/v1/property/leases/${leaseId}`)).status).toBe(404);

    const pay = await tenant.post(`/v1/property/rent-invoices/${inv!.id}/pay`);
    expect(pay.body.status).toBe('redirect');
    expect(pay.body.amountMinor).toBe(250000 + late!.penaltyMinor);
    await payMock(tenant, pay.body.paymentId);
    expect((await ctx.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.id, inv!.id) }))!.status).toBe('paid');
    const receipt = await tenant.get(`/v1/property/rent-invoices/${inv!.id}/receipt.pdf`);
    expect(receipt.headers['content-type']).toContain('application/pdf');

    const csv = await owner.get(`/v1/property/leases/${leaseId}/export?format=csv`);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('იჯარა');
    const xlsx = await owner.get(`/v1/property/leases/${leaseId}/export?format=xlsx`).buffer(true);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((await tenant.get(`/v1/property/leases/${leaseId}/export?format=csv`)).status).toBe(403);

    // autopay: tenant enables it, job charges the next open invoice
    expect((await tenant.patch(`/v1/property/leases/${leaseId}`).send({ rentMinor: 500000 })).status).toBe(403);
    expect((await tenant.patch(`/v1/property/leases/${leaseId}`).send({ autopay: true })).body.autopay).toBe(true);
    const [nextInv] = await ctx.db.insert(rentInvoices).values({ leaseId, period: '2030-01', amountMinor: 250000, dueOn: due, status: 'open' }).returning();
    const ap = await svc.autopay();
    expect(ap.charged).toBeGreaterThanOrEqual(1);
    expect((await ctx.db.query.rentInvoices.findFirst({ where: eq(rentInvoices.id, nextInv!.id) }))!.status).toBe('paid');
  });

  it('V9 maintenance, utilities and messages between owner and tenant', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const lease = await ctx.db.query.leases.findFirst({ where: and(eq(leases.tenantId, tenant.user.id), eq(leases.ownerId, owner.user.id)) });
    const m = await tenant.post(`/v1/property/leases/${lease!.id}/maintenance`).send({ title: 'კონდიციონერი არ მუშავს', priority: 'urgent', photos: ['/api/v1/media/placeholder/detail/x.svg'] });
    expect(m.status).toBe(201);
    expect(m.body.photos).toHaveLength(1);
    expect((await tenant.patch(`/v1/property/maintenance/${m.body.id}`).send({ status: 'resolved' })).status).toBe(403);
    expect((await owner.patch(`/v1/property/maintenance/${m.body.id}`).send({ status: 'in_progress' })).body.status).toBe('in_progress');
    expect((await owner.post(`/v1/property/leases/${lease!.id}/utilities`).send({ kind: 'electricity', period: '2026-09', reading: 13200, amountMinor: 31000 })).status).toBe(201);
    await owner.post(`/v1/property/leases/${lease!.id}/messages`).send({ body: 'ხელოსანი ხვალ 11-ზე მოვა' });
    const detail = await tenant.get(`/v1/property/leases/${lease!.id}`);
    expect(detail.body.maintenance.some((x: { id: string }) => x.id === m.body.id)).toBe(true);
    expect(detail.body.utilities.some((u: { period: string }) => u.period === '2026-09')).toBe(true);
    const msg = detail.body.messages.find((x: { body: string }) => x.body.includes('ხელოსანი'));
    expect(msg.fromMe).toBe(false);
  });

  it('V6 analytics API: key auth, scopes, metering, rate limit; key CRUD shows raw key once', async () => {
    const noKey = await ctx.http().get('/v1/public/districts');
    expect(noKey.status).toBe(401);
    expect((await ctx.http().get('/v1/public/districts').set('x-api-key', 'lk_wrong')).status).toBe(401);

    const before = await ctx.db.execute<{ s: string }>(sql`SELECT coalesce(sum(count),0) AS s FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id WHERE k.prefix = ${DEMO_KEY.slice(0, 10)} AND u.endpoint = '/v1/public/traffic'`);
    for (const city of ['tbilisi', 'batumi', 'kutaisi', 'rustavi']) {
      const r = await ctx.http().get('/v1/public/districts').query({ city }).set('x-api-key', DEMO_KEY);
      expect(r.status).toBe(200);
      expect(r.body.items.length).toBeGreaterThan(0);
    }
    expect((await ctx.http().get('/v1/public/vacancy').set('x-api-key', DEMO_KEY)).status).toBe(403); // scope missing
    const vac = await ctx.http().get('/v1/public/traffic').query({ listingId: (await ctx.db.select({ id: listings.id }).from(listings).where(eq(listings.status, 'active')).limit(1))[0]!.id }).set('x-api-key', DEMO_KEY);
    expect(vac.status, JSON.stringify(vac.body)).toBe(200);
    expect(vac.headers['x-ratelimit-limit']).toBe('300');
    const after = await ctx.db.execute<{ s: string }>(sql`SELECT coalesce(sum(count),0) AS s FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id WHERE k.prefix = ${DEMO_KEY.slice(0, 10)} AND u.endpoint = '/v1/public/traffic'`);
    expect(Number(after[0]!.s)).toBe(Number(before[0]!.s) + 1);
    expect((await ctx.http().get('/v1/public/price-index').query({ months: 6 }).set('x-api-key', DEMO_KEY)).body.items).toHaveLength(6);
    expect((await ctx.http().get('/v1/public/scores').query({ city: 'tbilisi' }).set('x-api-key', DEMO_KEY)).body.items.length).toBeGreaterThan(0);
    const pdf = await ctx.http().get('/v1/public/reports/market.pdf').set('x-api-key', DEMO_KEY).buffer(true);
    expect(pdf.status).toBe(403); // demo key has no reports:read scope

    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const created = await tenant.post('/v1/api-keys').send({ name: 'ტესტ გასაღები', scopes: ['districts:read', 'reports:read'] });
    expect(created.status).toBe(201);
    expect(created.body.key).toMatch(/^lk_live_/);
    expect(created.body.planKey).toBe('api_trial');
    const list = await tenant.get('/v1/api-keys');
    expect(list.body[0]).not.toHaveProperty('key');
    expect((await ctx.http().get('/v1/public/vacancy').set('x-api-key', created.body.key)).status).toBe(403);
    expect((await ctx.http().get('/v1/public/reports/market.pdf').query({ city: 'batumi' }).set('x-api-key', created.body.key)).headers['content-type']).toContain('application/pdf');
    // trial: 10 requests / minute
    let limited = 0;
    for (let i = 0; i < 12; i++) if ((await ctx.http().get('/v1/public/districts').set('x-api-key', created.body.key)).status === 429) limited++;
    expect(limited).toBeGreaterThan(0);
    const usage = await tenant.get(`/v1/api-keys/${created.body.id}/usage`);
    expect(usage.body.days).toHaveLength(30);
    expect(usage.body.usedThisMonth).toBeGreaterThan(0);
    await tenant.delete(`/v1/api-keys/${created.body.id}`);
    expect((await ctx.http().get('/v1/public/districts').set('x-api-key', created.body.key)).status).toBe(401);
    void apiUsage;
  });

  it('V8 fx rates; V10 finance application with consent → partner handoff → signed status webhook → commission', async () => {
    const fx = await ctx.http().get('/v1/fx/rates');
    expect(fx.body.rates.USD).toBeGreaterThan(2);

    const products = (await ctx.http().get('/v1/finance/products')).body;
    const loan = products.find((p: { kind: string }) => p.kind === 'fitout_loan');
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    expect((await tenant.post('/v1/finance/applications').send({ productId: loan.id, amountMinor: 2_000_000, termMonths: 24 })).status).toBe(422);
    expect((await tenant.post('/v1/finance/applications').send({ productId: loan.id, amountMinor: 100, consent: true })).status).toBe(422);
    const app = await tenant.post('/v1/finance/applications').send({ productId: loan.id, amountMinor: 2_000_000, termMonths: 24, consent: true, companyName: 'შპს ტესტ' });
    expect(app.status).toBe(201);
    await ctx.queue.drain();
    const sent = await ctx.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, app.body.id) });
    expect(sent!.status).toBe('sent');
    expect(sent!.partnerRef).toBeTruthy();

    const body = JSON.stringify({ eventId: `evt_${Date.now()}`, ref: sent!.partnerRef, status: 'approved', approvedAmountMinor: 1_800_000 });
    const secret = createHmac('sha256', process.env.PAYMENTS_WEBHOOK_SECRET ?? 'dev_webhook_secret').update('finance:mock').digest('hex');
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect((await ctx.http().post('/v1/finance/webhooks/mock').set('content-type', 'application/json').set('x-signature', 'bad').send(body)).status).toBe(401);
    const ok = await ctx.http().post('/v1/finance/webhooks/mock').set('content-type', 'application/json').set('x-signature', sig).send(body);
    expect(ok.body.matched).toBe(true);
    const approved = await ctx.db.query.financeApplications.findFirst({ where: eq(financeApplications.id, app.body.id) });
    expect(approved!.status).toBe('approved');
    expect(approved!.commissionMinor).toBe(Math.round(1_800_000 * loan.commissionPct / 100));
    expect((await ctx.http().post('/v1/finance/webhooks/mock').set('content-type', 'application/json').set('x-signature', sig).send(body)).body.duplicate).toBe(true);
    expect((await tenant.get('/v1/finance/applications')).body.some((a: { id: string; status: string }) => a.id === app.body.id && a.status === 'approved')).toBe(true);

    const admin = await loginAs(ctx.app, PHONES.admin);
    const prod = await admin.post('/v1/admin/finance/products').send({ partner: 'ტესტ ბანკი', kind: 'insurance', name: 'ტესტ დაზღვევა', description: 'აღწერა', commissionPct: 5 });
    expect(prod.status).toBe(201);
    const app2 = await tenant.post('/v1/finance/applications').send({ productId: prod.body.id, amountMinor: 50000, consent: true });
    const sim = await admin.post(`/v1/admin/finance/applications/${app2.body.id}/simulate`).send({ status: 'rejected' });
    expect(sim.body.status).toBe('rejected');
  });
});
