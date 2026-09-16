import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, crmMatches, eq, notifications } from '@lokacia/db';
import { matchScore } from '@lokacia/contracts';
import { createApp, loginAs } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

const cafe = {
  businessTypes: ['cafe'],
  dealType: 'rent',
  title: 'კაფე ვაკეში — CRM მატჩინგის ტესტი',
  description: 'ტესტ',
  address: 'თბილისი, ჭავჭავაძის პრ. 10',
  lat: 41.7085,
  lng: 44.752,
  areaM2: 64,
  priceMinor: 300000,
  passport: { powerKw: 25, ceilingM: 3.4, hasHood: true, hasGas: true, wetPoints: 2, widthM: 8, depthM: 8 },
};

describe('CRM requirement matching (C2)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('scores hard filters and tolerances', () => {
    const l = { businessTypes: ['cafe'], dealType: 'rent', areaM2: 64, priceMinor: 300000, districtId: 'd1' };
    expect(matchScore({ businessType: 'cafe', dealType: 'rent', areaMin: 50, areaMax: 80, budgetMaxMinor: 350000, districtIds: ['d1'] }, l)).toBe(100);
    expect(matchScore({ businessType: 'retail', dealType: 'rent' }, l)).toBe(0);
    expect(matchScore({ businessType: 'cafe', budgetMaxMinor: 280000 }, l)).toBe(80); // +7% over budget
    expect(matchScore({ businessType: 'cafe', budgetMaxMinor: 200000 }, l)).toBe(0);
    expect(matchScore({ businessType: 'cafe', districtIds: ['d2'] }, l)).toBe(0);
    expect(matchScore({ businessType: 'cafe' }, l)).toBe(0); // too vague
  });

  it('publishing a matching listing creates a match and notifies the owning agent', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const districts = (await ctx.http().get('/v1/taxonomy/districts').query({ city: 'tbilisi' })).body as { id: string; slug: string }[];
    const vake = districts.find((d) => d.slug === 'vake')!;
    const contact = await manager
      .post('/v1/crm/contacts')
      .send({ name: 'მატჩინგის კლიენტი', phones: ['593111222'], ownerAgentId: manager.user.id, requirements: { businessType: 'cafe', dealType: 'rent', areaMin: 50, areaMax: 80, budgetMaxMinor: 350000, districtIds: [vake.id] } });
    expect(contact.status).toBe(201);

    const owner = await loginAs(ctx.app, PHONES.owner);
    const mod = await loginAs(ctx.app, PHONES.moderator);
    const good = await owner.post('/v1/listings').send({ ...cafe, submit: true });
    expect(good.status).toBe(201);
    const expensive = await owner.post('/v1/listings').send({ ...cafe, title: 'ძვირი კაფე ვაკეში — CRM ტესტი', priceMinor: 900000, submit: true });
    for (const id of [good.body.id, expensive.body.id]) expect((await mod.post(`/v1/listings/${id}/status`).send({ status: 'active' })).status).toBe(200);
    await ctx.queue.drain();

    const rows = await sys(ctx.db, (tx) => tx.select().from(crmMatches).where(eq(crmMatches.contactId, contact.body.id)));
    expect(rows.map((r) => r.listingId)).toContain(good.body.id);
    expect(rows.map((r) => r.listingId)).not.toContain(expensive.body.id);
    expect(rows.find((r) => r.listingId === good.body.id)!.score).toBeGreaterThanOrEqual(60);

    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, manager.user.id), eq(notifications.template, 'crm_match'), eq(notifications.channel, 'in_app')));
    expect(notes.some((n) => n.body?.includes('მატჩინგის კლიენტი'))).toBe(true);

    const tab = await manager.get(`/v1/crm/contacts/${contact.body.id}/matches`);
    expect(tab.body.map((m: { listing: { id: string } }) => m.listing.id)).toContain(good.body.id);

    // requirement change re-runs matching for this contact
    const patched = await manager.patch(`/v1/crm/contacts/${contact.body.id}`).send({ requirements: { businessType: 'cafe', dealType: 'rent', areaMin: 50, areaMax: 80, budgetMaxMinor: 1_000_000, districtIds: [vake.id] } });
    expect(patched.status).toBe(200);
    const after = await sys(ctx.db, (tx) => tx.select().from(crmMatches).where(eq(crmMatches.contactId, contact.body.id)));
    expect(after.map((r) => r.listingId)).toContain(expensive.body.id);

    // dismiss
    const m = tab.body[0];
    const dismissed = await manager.patch(`/v1/crm/contacts/${contact.body.id}/matches/${m.id}`).send({ status: 'dismissed' });
    expect(dismissed.body.status).toBe('dismissed');
  });

  it('other orgs never receive matches for contacts they cannot see', async () => {
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const list = await manager.get('/v1/crm/contacts').query({ q: 'მატჩინგის კლიენტი' });
    const id = list.body.items[0].id;
    expect((await other.get(`/v1/crm/contacts/${id}/matches`)).status).toBe(404);
    expect((await other.post(`/v1/crm/contacts/${id}/matches/refresh`)).status).toBe(404);
  });
});
