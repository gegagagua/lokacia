import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, invoices, listings, organizations, payments, reportPurchases, subscriptions } from '@lokacia/db';
import { SettingsService } from '../src/common/settings.service';
import { BillingService } from '../src/modules/billing/billing.service';
import { createApp, loginAs, PHONES } from './helpers';

const SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? 'dev_webhook_secret';
const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('hex');

describe('billing & payments (Phase 13)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let settings: SettingsService;
  beforeAll(async () => {
    ctx = await createApp();
    settings = ctx.app.get(SettingsService);
    await settings.set('launch_promo_until', '');
  });
  afterAll(async () => ctx.app.close());

  const webhook = (body: string, sig = sign(body)) => ctx.http().post('/v1/payments/webhooks/mock').set('content-type', 'application/json').set('x-signature', sig).send(body);

  it('lists plans publicly with promo flag', async () => {
    const res = await ctx.http().get('/v1/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.promoActive).toBe(false);
    expect(res.body.plans.map((p: { key: string }) => p.key)).toEqual(expect.arrayContaining(['vip_7', 'vip_30', 'owner', 'agency', 'report_basic', 'api_pro']));
  });

  it('checkout → signed webhook → subscription active (done-when), idempotent and signature-checked', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const idempotencyKey = `test-owner-${Date.now()}`;
    const res = await tenant.post('/v1/billing/checkout').send({ planKey: 'owner', idempotencyKey });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('redirect');
    expect(res.body.checkoutUrl).toContain(`/checkout/mock/${res.body.paymentId}`);
    expect(res.body.amountMinor).toBe(4900);

    // same idempotency key → same invoice/payment
    const again = await tenant.post('/v1/billing/checkout').send({ planKey: 'owner', idempotencyKey });
    expect(again.body.paymentId).toBe(res.body.paymentId);
    expect(again.body.invoiceId).toBe(res.body.invoiceId);

    const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.id, res.body.paymentId) });
    expect(payment!.status).toBe('pending');
    const sub0 = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.userId, tenant.user.id), eq(subscriptions.planKey, 'owner')) });
    expect(sub0!.status).toBe('pending');

    const body = JSON.stringify({ id: `evt_${Date.now()}`, ref: payment!.providerRef, status: 'succeeded', amount: 4900 });
    // wrong signature rejected, nothing changes
    const bad = await webhook(body, sign(`${body}x`));
    expect(bad.status).toBe(401);
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, payment!.id) }))!.status).toBe('pending');

    const ok = await webhook(body);
    expect(ok.status).toBe(200);
    expect(ok.body.duplicate).toBe(false);
    const sub = await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub0!.id) });
    expect(sub!.status).toBe('active');
    expect(sub!.periodEnd!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    const inv = await ctx.db.query.invoices.findFirst({ where: eq(invoices.id, res.body.invoiceId) });
    expect(inv!.status).toBe('paid');

    // replayed event is deduplicated and does not extend the period again
    const dup = await webhook(body);
    expect(dup.status).toBe(200);
    expect(dup.body.duplicate).toBe(true);
    const sub2 = await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub0!.id) });
    expect(sub2!.periodEnd!.getTime()).toBe(sub!.periodEnd!.getTime());
    // a different event id for an already-succeeded payment is also a no-op
    const other = JSON.stringify({ id: `evt_other_${Date.now()}`, ref: payment!.providerRef, status: 'succeeded', amount: 4900 });
    expect((await webhook(other)).status).toBe(200);
    expect((await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub0!.id) }))!.periodEnd!.getTime()).toBe(sub!.periodEnd!.getTime());

    // receipt PDF + overview
    const pdf = await tenant.get(`/v1/billing/invoices/${res.body.invoiceId}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    const overview = await tenant.get('/v1/billing/overview');
    expect(overview.body.subscriptions.find((s: { id: string }) => s.id === sub0!.id).status).toBe('active');

    // other users cannot see the invoice
    const owner = await loginAs(ctx.app, PHONES.owner);
    expect((await owner.get(`/v1/billing/invoices/${res.body.invoiceId}`)).status).toBe(404);
  });

  it('mock checkout page flow: failed payment → retry job issues a new checkout', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const listing = await ctx.db.query.listings.findFirst({ where: and(eq(listings.ownerId, owner.user.id), eq(listings.status, 'active')) });
    const res = await owner.post('/v1/billing/checkout').send({ planKey: 'vip_7', listingId: listing!.id, returnPath: '/account/listings' });
    expect(res.body.status).toBe('redirect');
    const summary = await owner.get(`/v1/billing/payments/${res.body.paymentId}`);
    expect(summary.body.amountMinor).toBe(1500);
    expect(summary.body.returnPath).toBe('/account/listings');

    const failed = await owner.post(`/v1/billing/payments/${res.body.paymentId}/mock-complete`).send({ outcome: 'failed' });
    expect(failed.body.status).toBe('failed');
    expect(failed.body.redirectUrl).toContain('status=failed');
    expect((await ctx.db.query.invoices.findFirst({ where: eq(invoices.id, res.body.invoiceId) }))!.status).toBe('failed');

    const retried = await ctx.app.get(BillingService).retryFailed();
    expect(retried.retried).toBeGreaterThanOrEqual(1);
    const latest = await ctx.db.query.payments.findFirst({ where: eq(payments.invoiceId, res.body.invoiceId), orderBy: (p, { desc }) => desc(p.createdAt) });
    expect(latest!.id).not.toBe(res.body.paymentId);
    expect(latest!.status).toBe('pending');

    const paid = await owner.post(`/v1/billing/payments/${latest!.id}/mock-complete`).send({ outcome: 'succeeded' });
    expect(paid.body.status).toBe('succeeded');
    await ctx.queue.drain();
    const l = await ctx.db.query.listings.findFirst({ where: eq(listings.id, listing!.id) });
    expect(l!.vipUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it('launch promo: checkout completes instantly at 0 ₾; report PDF generated', async () => {
    await settings.set('launch_promo_until', '2099-01-01');
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const district = await ctx.db.query.districts.findFirst({ where: (d, { eq: e }) => e(d.slug, 'vake') });
    const preview = await ctx.http().get('/v1/billing/reports/preview').query({ districtId: district!.id, businessType: 'cafe' });
    expect(preview.status).toBe(200);
    expect(preview.body.district.name).toBeTruthy();

    const res = await tenant.post('/v1/billing/checkout').send({ planKey: 'report_pro', districtId: district!.id, businessType: 'cafe', returnPath: '/reports' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.promo).toBe(true);
    expect(res.body.amountMinor).toBe(0);
    const inv = await ctx.db.query.invoices.findFirst({ where: eq(invoices.id, res.body.invoiceId) });
    expect(inv!.lines[0]!.name).toContain('უფასო პრომო-პერიოდში');
    await ctx.queue.drain();
    const purchase = await ctx.db.query.reportPurchases.findFirst({ where: eq(reportPurchases.invoiceId, res.body.invoiceId) });
    expect(purchase!.status).toBe('ready');
    const pdf = await tenant.get(`/v1/billing/reports/${purchase!.id}/pdf`).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((await tenant.get('/v1/billing/reports')).body.some((r: { id: string }) => r.id === purchase!.id)).toBe(true);
    await settings.set('launch_promo_until', '');
  });

  it('org plan needs a manager; grace period then downgrade to free', async () => {
    const agent = await loginAs(ctx.app, PHONES.agent);
    const manager = await loginAs(ctx.app, PHONES.agencyManager);
    const orgId = manager.user.orgs[0]!.id;
    expect((await agent.post('/v1/billing/checkout').send({ planKey: 'agency', orgId })).status).toBe(403);

    const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.orgId, orgId), eq(subscriptions.status, 'active')) });
    expect(sub).toBeTruthy();
    await ctx.db.update(organizations).set({ plan: sub!.planKey }).where(eq(organizations.id, orgId));
    await ctx.db.update(subscriptions).set({ periodEnd: new Date(Date.now() - 3600_000) }).where(eq(subscriptions.id, sub!.id));
    const billing = ctx.app.get(BillingService);
    await billing.runLifecycle();
    const pastDue = await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub!.id) });
    expect(pastDue!.status).toBe('past_due');
    expect(pastDue!.graceUntil!.getTime()).toBeGreaterThan(Date.now());
    const renewal = await ctx.db.query.invoices.findFirst({ where: and(eq(invoices.subscriptionId, sub!.id), eq(invoices.status, 'open')) });
    expect(renewal).toBeTruthy();

    // grace passes without payment
    await ctx.db.update(subscriptions).set({ graceUntil: new Date(Date.now() - 1000) }).where(eq(subscriptions.id, sub!.id));
    await billing.runLifecycle();
    const expired = await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub!.id) });
    expect(expired!.status).toBe('expired');
    const org = await ctx.db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    expect(org!.plan).toBe('free');
  });

  it('cancel at period end', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(subscriptions.userId, tenant.user.id), eq(subscriptions.status, 'active')) });
    const res = await tenant.post(`/v1/billing/subscriptions/${sub!.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.cancelAtPeriodEnd).toBe(true);
    await ctx.db.update(subscriptions).set({ periodEnd: new Date(Date.now() - 1000) }).where(eq(subscriptions.id, sub!.id));
    await ctx.app.get(BillingService).runLifecycle();
    expect((await ctx.db.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub!.id) }))!.status).toBe('cancelled');
  });
});
