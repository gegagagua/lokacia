import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, crmContacts, crmMatches, eq, isNotNull, notifications } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

describe('CRM client portal (C8)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('sends a selection to the portal; client reacts without login; agent is notified', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.portalToken, 'demo-client-portal')));
    expect(contact).toBeTruthy();
    // make sure the manager owns the demo contact so we can assert the notification
    await sys(ctx.db, (tx) => tx.update(crmContacts).set({ ownerAgentId: manager.user.id }).where(eq(crmContacts.id, contact!.id)));
    const matches = await sys(ctx.db, (tx) => tx.select().from(crmMatches).where(eq(crmMatches.contactId, contact!.id)));
    expect(matches.length).toBeGreaterThan(0);
    await sys(ctx.db, (tx) => tx.update(crmMatches).set({ status: 'new' }).where(eq(crmMatches.contactId, contact!.id)));

    const sent = await manager.post(`/v1/crm/contacts/${contact!.id}/portal/send`).send({ matchIds: matches.map((m) => m.id) });
    expect(sent.status).toBe(200);
    expect(sent.body.sent).toBe(matches.length);
    expect(sent.body.url).toContain('/portal/demo-client-portal');

    const pub = await ctx.http().get('/v1/crm/portal/demo-client-portal');
    expect(pub.status).toBe(200);
    expect(pub.body.org.name).toBeTruthy();
    expect(pub.body.items.length).toBe(matches.length);
    expect(pub.body.contact.firstName).toBe(contact!.name.split(' ')[0]);
    expect(JSON.stringify(pub.body)).not.toContain(contact!.phones[0]!);

    const target = pub.body.items[0];
    const liked = await ctx.http().post(`/v1/crm/portal/demo-client-portal/matches/${target.matchId}`).send({ reaction: 'liked', comment: 'ვიტრინა ძალიან მომწონს' });
    expect(liked.status).toBe(200);
    expect(liked.body.status).toBe('liked');
    const [row] = await sys(ctx.db, (tx) => tx.select().from(crmMatches).where(eq(crmMatches.id, target.matchId)));
    expect(row!.clientComment).toBe('ვიტრინა ძალიან მომწონს');
    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, manager.user.id), eq(notifications.template, 'crm_portal_feedback'), isNotNull(notifications.body)));
    expect(notes.length).toBeGreaterThan(0);

    // agent sees feedback in the matches tab
    const tab = await manager.get(`/v1/crm/contacts/${contact!.id}/matches`);
    expect(tab.body.find((m: { id: string }) => m.id === target.matchId)).toMatchObject({ status: 'liked', clientComment: 'ვიტრინა ძალიან მომწონს' });
  });

  it('rejects unknown tokens and matches of another contact', async () => {
    expect((await ctx.http().get('/v1/crm/portal/no-such-token-123')).status).toBe(404);
    const foreign = await sys(ctx.db, async (tx) => {
      const [demo] = await tx.select().from(crmContacts).where(eq(crmContacts.portalToken, 'demo-client-portal'));
      return (await tx.select().from(crmMatches)).find((m) => m.contactId !== demo!.id);
    });
    const res = await ctx.http().post(`/v1/crm/portal/demo-client-portal/matches/${foreign!.id}`).send({ reaction: 'disliked' });
    expect(res.status).toBe(404);
    // matches not yet sent are not visible/reactable
    const [demo] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.portalToken, 'demo-client-portal')));
    const [m] = await sys(ctx.db, (tx) => tx.update(crmMatches).set({ status: 'new' }).where(eq(crmMatches.contactId, demo!.id)).returning());
    expect((await ctx.http().post(`/v1/crm/portal/demo-client-portal/matches/${m!.id}`).send({ reaction: 'liked' })).status).toBe(404);
  });
});
