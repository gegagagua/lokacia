import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, crmActivities, crmSequenceRuns, eq, listings } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

/** Phase 10 done-when: an agent works a lead from contact → deal → viewing → offer → closed (won) entirely through the CRM API. */
describe('CRM lead flow (Phase 10 end to end)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('contact → deal → task → call → viewing → offer → contract → won', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const [listing] = await ctx.db.select().from(listings).where(and(eq(listings.orgId, agent.orgId), eq(listings.status, 'active'))).limit(1);
    expect(listing).toBeTruthy();

    const context = await agent.get('/v1/crm/context');
    const stages = context.body.pipeline.stages as { key: string; kind: string }[];
    const open = stages.filter((st) => st.kind === 'open').map((st) => st.key);
    const wonKey = stages.find((st) => st.kind === 'won')!.key;
    expect(open.length).toBeGreaterThanOrEqual(2);

    // 1. new lead
    const contact = await agent.post('/v1/crm/contacts').send({ type: 'client', name: 'ლიდი ფლოუ ტესტი', phones: ['599 45 67 89'], source: 'facebook', requirements: { businessType: listing!.businessTypes[0], dealType: listing!.dealType, areaMin: 10, areaMax: 2000 } });
    expect(contact.status).toBe(201);
    expect(contact.body.phones).toEqual(['+995599456789']);
    expect(contact.body.ownerAgentId).toBe(agent.user.id);

    // 2. deal on the kanban (first open stage)
    const deal = await agent.post('/v1/crm/deals').send({ contactId: contact.body.id, listingId: listing!.id, title: 'ლიდი ფლოუ — ფართი', valueMinor: 1_200_000, commissionPct: 10, agentSharePct: 50 });
    expect(deal.status).toBe(201);
    const dealId = deal.body.id as string;
    expect(deal.body.stage).toBe(open[0]);

    // 3. follow-up task + call log
    const task = await agent.post('/v1/crm/tasks').send({ title: 'დაურეკე ჩვენების დასაგეგმავად', dealId, contactId: contact.body.id, dueAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(task.status).toBe(201);
    expect((await agent.post('/v1/crm/calls').send({ entity: 'contact', entityId: contact.body.id, phone: '+995599456789', outcome: 'answered', durationSec: 120, note: 'ჩვენება ხვალ' })).status).toBe(201);
    expect((await agent.post(`/v1/crm/tasks/${task.body.id}/complete`)).status).toBeLessThan(300);

    // 4. viewing from the deal, move deal to viewing, mark viewing done
    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const viewing = await agent.post('/v1/crm/viewings').send({ dealId, contactId: contact.body.id, listingId: listing!.id, startsAt, durationMin: 45 });
    expect(viewing.status).toBe(201);
    expect((await agent.post(`/v1/crm/deals/${dealId}/move`).send({ stage: open[1], position: 0 })).status).toBeLessThan(300);
    expect((await agent.patch(`/v1/crm/viewings/${viewing.body.id}`).send({ status: 'done' })).status).toBe(200);

    // 5. offer → contract → won
    for (const stage of [...open.slice(2), wonKey]) {
      const moved = await agent.post(`/v1/crm/deals/${dealId}/move`).send({ stage, position: 0 });
      expect(moved.status).toBeLessThan(300);
    }
    const detail = await agent.get(`/v1/crm/deals/${dealId}`);
    expect(detail.body.stage).toBe(wonKey);
    expect(detail.body.closedAt).toBeTruthy();

    const changes = await sys(ctx.db, (tx) => tx.select().from(crmActivities).where(and(eq(crmActivities.entityId, dealId), eq(crmActivities.type, 'stage_change'))));
    expect(changes.map((c) => (c.payload as { to: string }).to)).toEqual(expect.arrayContaining([...open.slice(1), wonKey]));

    // timeline of the contact shows the call; runs for this contact are not left running after the win
    const tl = await agent.get(`/v1/crm/activities?entity=contact&entityId=${contact.body.id}`);
    expect(tl.body.some((a: { type: string }) => a.type === 'call')).toBe(true);
    const runs = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.contactId, contact.body.id)));
    expect(runs.every((r) => r.status !== 'running')).toBe(true);

    // KPI for the agent counts the won deal
    const kpi = await agent.get('/v1/crm/analytics/kpi');
    expect(kpi.status).toBe(200);
    expect(JSON.stringify(kpi.body)).toContain('won');
  });
});
