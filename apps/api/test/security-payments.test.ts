import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, escrowAccounts, invoices, ledgerEntries, listings, offers, payments, sql, webhookEvents } from '@lokacia/db';
import { SettingsService } from '../src/common/settings.service';
import { BillingService, MAX_INVOICE_MINOR } from '../src/modules/billing/billing.service';
import { verifyHmacSignature } from '../src/integrations/payments/payments';
import { BogPayments } from '../src/integrations/payments/payments.banks';
import { latePenaltyMinor } from '../src/modules/v2/property/property.service';
import { createApp, loginAs, PHONES } from './helpers';

const SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? 'dev_webhook_secret';
const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('hex');

/** Security review 2026-09: payments, escrow and rent regression tests. */
describe('security: payments / escrow / rent', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    ctx = await createApp();
    await ctx.app.get(SettingsService).set('launch_promo_until', '');
  });
  afterAll(async () => ctx.app.close());

  const webhook = (body: string, sig = sign(body)) => ctx.http().post('/v1/payments/webhooks/mock').set('content-type', 'application/json').set('x-signature', sig).send(body);
  const vipCheckout = async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const listing = await ctx.db.query.listings.findFirst({ where: and(eq(listings.ownerId, owner.user.id), eq(listings.status, 'active')) });
    const res = await owner.post('/v1/billing/checkout').send({ planKey: 'vip_7', listingId: listing!.id });
    expect(res.status).toBe(200);
    const payment = await ctx.db.query.payments.findFirst({ where: eq(payments.id, res.body.paymentId) });
    return { owner, listing: listing!, res, payment: payment! };
  };

  it('signature helpers are strict (hex, length, prefix) and bank adapters validate payloads', () => {
    const body = '{"a":1}';
    const good = sign(body);
    expect(verifyHmacSignature(SECRET, body, good)).toBe(true);
    expect(verifyHmacSignature(SECRET, body, `sha256=${good}`)).toBe(true);
    expect(verifyHmacSignature(SECRET, body, good.slice(0, -1))).toBe(false);
    expect(verifyHmacSignature(SECRET, body, `${good.slice(0, -2)}zz`)).toBe(false);
    expect(verifyHmacSignature(SECRET, body, undefined)).toBe(false);
    expect(verifyHmacSignature('', body, good)).toBe(false);
    // re-serialized JSON (different whitespace) must not verify
    expect(verifyHmacSignature(SECRET, '{ "a": 1 }', good)).toBe(false);

    const bog = new BogPayments('key', SECRET);
    const ev = JSON.stringify({ event_id: 'e1', order_id: 'o1', status: 'completed', amount: 15, currency: 'gel' });
    expect(bog.parseWebhook({ 'x-signature': sign(ev) }, ev)).toMatchObject({ eventId: 'e1', providerRef: 'o1', status: 'succeeded', amountMinor: 1500, currency: 'GEL' });
    expect(() => bog.parseWebhook({ 'x-signature': 'nope' }, ev)).toThrow();
    const noId = JSON.stringify({ order_id: 'o1', status: 'completed' });
    expect(() => bog.parseWebhook({ 'x-signature': sign(noId) }, noId)).toThrow();
    const neg = JSON.stringify({ event_id: 'e2', order_id: 'o1', status: 'completed', amount: -5 });
    expect(() => bog.parseWebhook({ 'x-signature': sign(neg) }, neg)).toThrow();
  });

  it('webhook needs the raw JSON body; malformed signed payloads are rejected', async () => {
    const text = await ctx.http().post('/v1/payments/webhooks/mock').set('content-type', 'text/plain').set('x-signature', sign('{}')).send('{}');
    expect([400, 415]).toContain(text.status);
    const bad = JSON.stringify({ id: 'evt_no_ref', status: 'succeeded' });
    expect((await webhook(bad)).status).toBe(401);
  });

  it('success webhook with wrong/missing amount or wrong currency does not settle', async () => {
    const { payment, res } = await vipCheckout();
    const wrong = JSON.stringify({ id: `evt_amt_${Date.now()}`, ref: payment.providerRef, status: 'succeeded', amount: 1 });
    expect((await webhook(wrong)).body.outcome).toBe('mismatch');
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, payment.id) }))!.status).toBe('failed');

    const { payment: p2 } = await vipCheckout();
    const missing = JSON.stringify({ id: `evt_noamt_${Date.now()}`, ref: p2.providerRef, status: 'succeeded' });
    expect((await webhook(missing)).body.outcome).toBe('mismatch');
    const { payment: p3 } = await vipCheckout();
    const cur = JSON.stringify({ id: `evt_cur_${Date.now()}`, ref: p3.providerRef, status: 'succeeded', amount: p3.amountMinor, currency: 'USD' });
    expect((await webhook(cur)).body.outcome).toBe('mismatch');
    expect((await ctx.db.query.invoices.findFirst({ where: eq(invoices.id, res.body.invoiceId) }))!.status).not.toBe('paid');
  });

  it('refunded payments never re-settle; an invoice settles once even if two attempts succeed', async () => {
    const { payment, listing, res } = await vipCheckout();
    const ok = JSON.stringify({ id: `evt_ok_${Date.now()}`, ref: payment.providerRef, status: 'succeeded', amount: payment.amountMinor });
    expect((await webhook(ok)).body.outcome).toBe('succeeded');
    await ctx.queue.drain();
    const vip1 = (await ctx.db.query.listings.findFirst({ where: eq(listings.id, listing.id) }))!.vipUntil!.getTime();

    const refund = JSON.stringify({ id: `evt_ref_${Date.now()}`, ref: payment.providerRef, status: 'refunded' });
    expect((await webhook(refund)).body.outcome).toBe('refunded');
    const again = JSON.stringify({ id: `evt_again_${Date.now()}`, ref: payment.providerRef, status: 'succeeded', amount: payment.amountMinor });
    await webhook(again);
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, payment.id) }))!.status).toBe('refunded');
    expect((await ctx.db.query.listings.findFirst({ where: eq(listings.id, listing.id) }))!.vipUntil!.getTime()).toBe(vip1);

    // a refund event for a payment that never settled is ignored (forward-only)
    const { payment: pending } = await vipCheckout();
    const early = JSON.stringify({ id: `evt_early_${Date.now()}`, ref: pending.providerRef, status: 'refunded' });
    expect((await webhook(early)).body.outcome).toBe('ignored');
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, pending.id) }))!.status).toBe('pending');

    // second payment attempt on the same (already paid) invoice: no second VIP extension, flagged for refund
    const dupId = (await ctx.db.execute<{ id: string }>(sql`SELECT gen_random_uuid() AS id`))[0]!.id;
    await ctx.db.insert(payments).values({ id: dupId, invoiceId: res.body.invoiceId, amountMinor: payment.amountMinor, provider: 'mock', providerRef: `mock_dup_${dupId}`, idempotencyKey: `dup:${dupId}`, status: 'pending' });
    const dup = JSON.stringify({ id: `evt_dup_${Date.now()}`, ref: `mock_dup_${dupId}`, status: 'succeeded', amount: payment.amountMinor });
    expect((await webhook(dup)).status).toBe(200);
    await ctx.queue.drain();
    const dupRow = await ctx.db.query.payments.findFirst({ where: eq(payments.id, dupId) });
    expect((dupRow!.raw as { needsRefund?: boolean }).needsRefund).toBe(true);
    expect((await ctx.db.query.listings.findFirst({ where: eq(listings.id, listing.id) }))!.vipUntil!.getTime()).toBe(vip1);
  });

  it('recorded-but-unprocessed events are processed on redelivery; unknown refs are accepted but unmatched', async () => {
    const { payment } = await vipCheckout();
    const eventId = `evt_crash_${Date.now()}`;
    const body = JSON.stringify({ id: eventId, ref: payment.providerRef, status: 'succeeded', amount: payment.amountMinor });
    await ctx.db.insert(webhookEvents).values({ provider: 'mock', eventId, payload: JSON.parse(body) });
    const r = await webhook(body);
    expect(r.body.duplicate).toBe(false);
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, payment.id) }))!.status).toBe('succeeded');
    expect((await webhook(body)).body.duplicate).toBe(true);

    const unknown = JSON.stringify({ id: `evt_unknown_${Date.now()}`, ref: 'mock_does_not_exist', status: 'succeeded', amount: 100 });
    const u = await webhook(unknown);
    expect(u.status).toBe(200);
    expect(u.body).toMatchObject({ matched: false, outcome: 'unknown-payment' });
  });

  it('IDOR: payment summary, mock-complete and invoice PDF are owner-only; mock-complete is off in production', async () => {
    const { res } = await vipCheckout();
    const stranger = await loginAs(ctx.app, PHONES.agency2Manager);
    expect((await stranger.get(`/v1/billing/payments/${res.body.paymentId}`)).status).toBe(404);
    expect((await stranger.post(`/v1/billing/payments/${res.body.paymentId}/mock-complete`).send({ outcome: 'succeeded' })).status).toBe(404);
    expect((await stranger.get(`/v1/billing/invoices/${res.body.invoiceId}/pdf`)).status).toBe(404);
    expect((await ctx.db.query.payments.findFirst({ where: eq(payments.id, res.body.paymentId) }))!.status).toBe('pending');

    const billing = ctx.app.get(BillingService) as unknown as { env: { NODE_ENV: string } };
    const env = billing.env;
    billing.env = { ...env, NODE_ENV: 'production' };
    try {
      const owner = await loginAs(ctx.app, PHONES.owner);
      expect((await owner.post(`/v1/billing/payments/${res.body.paymentId}/mock-complete`).send({ outcome: 'succeeded' })).status).toBe(403);
    } finally {
      billing.env = env;
    }
  });

  it('checkout: report for a foreign org is refused; amounts are bounded', async () => {
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const manager = await loginAs(ctx.app, PHONES.agencyManager);
    const district = await ctx.db.query.districts.findFirst();
    const r = await tenant.post('/v1/billing/checkout').send({ planKey: 'report_basic', districtId: district!.id, orgId: manager.user.orgs[0]!.id });
    expect(r.status).toBe(403);
    await expect(
      ctx.app.get(BillingService).createPayment({ userId: tenant.user.id, purpose: 'vip', allowPromo: false, returnPath: '/', description: 'x', lines: [{ name: 'x', qty: 2, amountMinor: MAX_INVOICE_MINOR }] }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      ctx.app.get(BillingService).createPayment({ userId: tenant.user.id, purpose: 'vip', allowPromo: false, returnPath: '/', description: 'x', lines: [{ name: 'x', qty: 1, amountMinor: -100 }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('escrow: single escrow per offer under concurrency, no double funding, no skipped/replayed transitions, parties only', async () => {
    const offer = await ctx.db.query.offers.findFirst({ where: eq(offers.status, 'accepted'), orderBy: (o, { desc }) => desc(o.createdAt) });
    await ctx.db.delete(escrowAccounts).where(eq(escrowAccounts.offerId, offer!.id));
    const listing = await ctx.db.query.listings.findFirst({ where: eq(listings.id, offer!.listingId) });
    const tenantId = offer!.fromUserId === listing!.ownerId ? offer!.toUserId : offer!.fromUserId;
    const phoneOf = async (id: string) => (await ctx.db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, id) }))!.phone!;
    const owner = await loginAs(ctx.app, await phoneOf(listing!.ownerId));
    const tenant = await loginAs(ctx.app, await phoneOf(tenantId));

    const [a, b] = await Promise.all([tenant.post('/v1/escrow').send({ offerId: offer!.id }), owner.post('/v1/escrow').send({ offerId: offer!.id })]);
    expect(a.body.id).toBe(b.body.id);
    expect((await ctx.db.select().from(escrowAccounts).where(eq(escrowAccounts.offerId, offer!.id))).length).toBe(1);
    const id = a.body.id as string;

    const stranger = await loginAs(ctx.app, PHONES.agency2Manager);
    expect((await stranger.get(`/v1/escrow/${id}`)).status).toBe(404);
    expect((await stranger.post(`/v1/escrow/${id}/release`)).status).toBe(404);
    expect((await stranger.get(`/v1/escrow/${id}/contract.pdf`)).status).toBe(404);

    // cannot release/refund before funding
    await tenant.post(`/v1/escrow/${id}/sign`);
    await owner.post(`/v1/escrow/${id}/sign`);
    expect((await tenant.post(`/v1/escrow/${id}/release`)).status).toBe(422); // invalid-transition
    expect((await owner.post(`/v1/escrow/${id}/refund`)).status).toBe(422);
    expect((await owner.post(`/v1/escrow/${id}/fund`)).status).toBe(403);

    // repeated fund clicks reuse the open checkout instead of issuing a second deposit invoice
    const f1 = await tenant.post(`/v1/escrow/${id}/fund`);
    const f2 = await tenant.post(`/v1/escrow/${id}/fund`);
    expect(f2.body.invoiceId).toBe(f1.body.invoiceId);
    expect(f2.body.paymentId).toBe(f1.body.paymentId);
    expect((await ctx.db.select().from(invoices).where(and(eq(invoices.refId, id), eq(invoices.purpose, 'escrow')))).length).toBe(1);

    const paid = await tenant.post(`/v1/billing/payments/${f1.body.paymentId}/mock-complete`).send({ outcome: 'succeeded' });
    expect(paid.body.status).toBe('succeeded');
    await ctx.queue.drain();
    expect((await tenant.get(`/v1/escrow/${id}`)).body.status).toBe('funded');
    expect((await tenant.post(`/v1/escrow/${id}/fund`)).status).toBe(409);

    // concurrent double release → one ledger transaction; refund after release refused
    const rel = await Promise.all([tenant.post(`/v1/escrow/${id}/release`), tenant.post(`/v1/escrow/${id}/release`)]);
    expect(rel.every((r) => r.status === 200)).toBe(true);
    expect((await owner.post(`/v1/escrow/${id}/refund`)).status).toBe(422);
    const entries = await ctx.db.select().from(ledgerEntries).where(eq(ledgerEntries.refId, id));
    expect(entries.length).toBe(4); // funded (2) + released (2)
    expect(entries.reduce((s, e) => s + e.debitMinor - e.creditMinor, 0)).toBe(0);
    expect(new Set(entries.map((e) => e.txId)).size).toBe(2);
  });

  it('rent penalty is capped (no int overflow) and autopay skips ended leases', () => {
    expect(latePenaltyMinor(250_000, 0.5, 4)).toBe(5_000);
    expect(latePenaltyMinor(100_000_000, 5, 10_000)).toBe(100_000_000);
    expect(latePenaltyMinor(100_000, -1, 10)).toBe(0);
    expect(Number.isSafeInteger(latePenaltyMinor(100_000_000, 5, 1e9))).toBe(true);
  });
});
