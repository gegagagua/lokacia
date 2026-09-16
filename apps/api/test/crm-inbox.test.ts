import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conversations, crmContacts, eq, messages } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES, sys } from './crm-helpers';
import { CHANNELS, type MessageChannel } from '../src/integrations/channels/channels';
import type { MockChannel } from '../src/integrations/channels/channels.mock';

describe('CRM unified inbox (C6)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('webhook auto-links an existing contact by phone (any stored format) and creates a conversation', async () => {
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    const contacts = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, orgId)));
    // pick a contact stored in a messy local format (e.g. "5xx 123456" or "05xx…")
    const messy = contacts.find((c) => c.phones[0] && !c.phones[0].startsWith('+')) ?? contacts[0]!;
    const digits = messy.phones[0]!.replace(/\D/g, '').slice(-9);
    const res = await ctx.http().post('/v1/crm/inbox/webhooks/whatsapp').set('x-lk-webhook', 'dev').send({ orgId, from: `+995${digits}`, name: 'WA', text: 'გამარჯობა, ფართი ისევ თავისუფალია?' });
    expect(res.status).toBe(200);
    expect(res.body.createdContact).toBe(false);
    const target = contacts.filter((c) => c.phones.some((p) => p.replace(/\D/g, '').slice(-9) === digits)).sort((a, b) => +a.createdAt - +b.createdAt)[0]!;
    expect(res.body.contactId).toBe(target.id);
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const list = await manager.get('/v1/crm/inbox');
    const conv = list.body.find((c: { id: string }) => c.id === res.body.conversationId);
    expect(conv).toMatchObject({ channel: 'whatsapp', unread: 1, contactId: target.id });
    const msgs = await manager.get(`/v1/crm/inbox/${conv.id}/messages`);
    expect(msgs.body[0]).toMatchObject({ direction: 'in', body: 'გამარჯობა, ფართი ისევ თავისუფალია?' });
    expect((await manager.get(`/v1/crm/inbox/${conv.id}`)).body.unread).toBe(0);
    // same sender reuses the conversation
    const again = await ctx.http().post('/v1/crm/inbox/webhooks/whatsapp').set('x-lk-webhook', 'dev').send({ orgId, from: `0${digits}`, text: 'კიდევ ერთი' });
    expect(again.body.conversationId).toBe(res.body.conversationId);
  });

  it('rejects webhooks without the secret', async () => {
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    expect((await ctx.http().post('/v1/crm/inbox/webhooks/viber').send({ orgId, from: '+995599000111', text: 'x' })).status).toBe(403);
  });

  it('unknown sender creates a contact; reply goes out through the channel adapter', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const sim = await manager.post('/v1/crm/inbox/simulate').send({ channel: 'whatsapp', from: '+995599777888', name: 'ნინო ახალი', text: 'ოფისი მჭირდება ვაკეში' });
    expect(sim.status).toBe(201);
    expect(sim.body.createdContact).toBe(true);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, sim.body.contactId)));
    expect(contact).toMatchObject({ name: 'ნინო ახალი', source: 'whatsapp', phones: ['+995599777888'] });
    const whatsapp = ctx.app.get<Record<string, MessageChannel>>(CHANNELS).whatsapp as MockChannel;
    const before = whatsapp.outbox.length;
    const reply = await manager.post(`/v1/crm/inbox/${sim.body.conversationId}/messages`).send({ body: 'გამარჯობა! ხვალ 3 ვარიანტს გაჩვენებთ.' });
    expect(reply.status).toBe(201);
    expect(reply.body.direction).toBe('out');
    expect(whatsapp.outbox.length).toBe(before + 1);
    expect(whatsapp.outbox.at(-1)).toMatchObject({ to: '+995599777888', body: 'გამარჯობა! ხვალ 3 ვარიანტს გაჩვენებთ.' });
    const stored = await ctx.db.select().from(messages).where(eq(messages.conversationId, sim.body.conversationId));
    expect(stored.map((m) => m.direction).sort()).toEqual(['in', 'out']);
  });

  it('links a conversation to a contact and hides it from other orgs', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const sim = await manager.post('/v1/crm/inbox/simulate').send({ channel: 'telegram', from: '99887766', text: 'გამარჯობა' });
    const [c] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, manager.orgId)).limit(1));
    const linked = await manager.post(`/v1/crm/inbox/${sim.body.conversationId}/link`).send({ contactId: c!.id });
    expect(linked.body.contactId).toBe(c!.id);
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get(`/v1/crm/inbox/${sim.body.conversationId}/messages`)).status).toBe(404);
    expect((await other.post(`/v1/crm/inbox/${sim.body.conversationId}/messages`).send({ body: 'x' })).status).toBe(404);
    const list = await other.get('/v1/crm/inbox');
    expect(list.body.map((x: { id: string }) => x.id)).not.toContain(sim.body.conversationId);
    const [conv] = await ctx.db.select().from(conversations).where(eq(conversations.id, sim.body.conversationId));
    expect(conv!.orgId).toBe(manager.orgId);
  });
});
