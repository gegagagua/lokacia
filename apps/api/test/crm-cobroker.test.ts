import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull, listings, sql, withSystem } from '@lokacia/db';
import { createApp, loginAs } from './helpers';
import { crmLogin, PHONES } from './crm-helpers';

describe('CRM co-brokering (C22)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('shares an org listing with a split, target accepts and sees it; others cannot', async () => {
    const a = await crmLogin(ctx.app, PHONES.agencyManager);
    const b = await crmLogin(ctx.app, PHONES.agency2Manager);
    const owned = await withSystem(ctx.db, (tx) => tx.select().from(listings).where(and(eq(listings.orgId, a.orgId), eq(listings.status, 'active'), isNull(listings.deletedAt), sql`not exists (select 1 from co_broker_shares s where s.listing_id = ${listings.id})`)));
    const listing = owned[owned.length - 1]!;
    expect(listing).toBeTruthy();

    const foreign = await ctx.db.select().from(listings).where(eq(listings.orgId, b.orgId)).limit(1);
    if (foreign[0]) expect((await a.post('/v1/crm/cobroker').send({ listingId: foreign[0].id, toOrgId: b.orgId, splitPct: 40 })).status).toBe(400);

    const orgs = await a.get('/v1/crm/cobroker/orgs?q=business');
    expect(orgs.body.map((o: { id: string }) => o.id)).toContain(b.orgId);

    const share = await a.post('/v1/crm/cobroker').send({ listingId: listing.id, toOrgId: b.orgId, splitPct: 40, note: 'კომისია 60/40' });
    expect(share.status).toBe(201);
    expect(share.body).toMatchObject({ status: 'proposed', splitPct: 40 });
    expect((await a.post('/v1/crm/cobroker').send({ listingId: listing.id, toOrgId: b.orgId, splitPct: 30 })).status).toBe(409);

    // source cannot accept its own proposal; agent of target org cannot accept
    expect((await a.post(`/v1/crm/cobroker/${share.body.id}/accept`)).status).toBe(404);
    const incoming = await b.get('/v1/crm/cobroker');
    expect(incoming.body.incoming.map((s: { id: string }) => s.id)).toContain(share.body.id);

    // unrelated user with an own org (created in-test) sees nothing and cannot accept
    const stranger = await loginAs(ctx.app, '+995599777111');
    const org = await stranger.post('/v1/orgs').send({ name: 'მესამე აგენტურა', type: 'agency' });
    stranger.set('x-org-id', org.body.id);
    const strangerList = await stranger.get('/v1/crm/cobroker');
    expect([...strangerList.body.incoming, ...strangerList.body.outgoing]).toHaveLength(0);
    expect((await stranger.post(`/v1/crm/cobroker/${share.body.id}/accept`)).status).toBe(404);

    const accepted = await b.post(`/v1/crm/cobroker/${share.body.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('accepted');
    const shared = await b.get('/v1/crm/cobroker/shared-listings');
    expect(shared.body.find((s: { id: string }) => s.id === share.body.id)?.listing?.id).toBe(listing.id);
    expect((await b.post(`/v1/crm/cobroker/${share.body.id}/decline`)).status).toBe(422);

    const revoked = await a.post(`/v1/crm/cobroker/${share.body.id}/revoke`);
    expect(revoked.body.status).toBe('revoked');
    expect((await b.get('/v1/crm/cobroker/shared-listings')).body.map((s: { id: string }) => s.id)).not.toContain(share.body.id);
  });
});
