import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, eq } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

describe('CRM audit log viewer (C24)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('shows org mutations with actor names to managers only', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [contact] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, manager.orgId)).limit(1));
    await manager.post('/v1/crm/calls').send({ entityId: contact!.id, phone: contact!.phones[0], outcome: 'no_answer' });
    await new Promise((r) => setTimeout(r, 150)); // audit write is fire-and-forget
    const res = await manager.get('/v1/crm/audit?entity=crm&limit=5');
    expect(res.status).toBe(200);
    const row = res.body.items.find((i: { action: string }) => i.action === 'post crm.calls');
    expect(row).toMatchObject({ actorName: manager.user.id ? expect.any(String) : null, entity: 'crm' });
    expect(res.body.entities).toContain('crm');

    const page1 = await manager.get('/v1/crm/audit?limit=1');
    if (page1.body.nextCursor) {
      const page2 = await manager.get(`/v1/crm/audit?limit=1&cursor=${page1.body.nextCursor}`);
      expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
    }

    const agent = await crmLogin(ctx.app, PHONES.agent);
    expect((await agent.get('/v1/crm/audit')).status).toBe(403);
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const otherRes = await other.get('/v1/crm/audit?limit=100');
    expect(otherRes.body.items.map((i: { id: string }) => i.id)).not.toContain(row.id);
  });
});
