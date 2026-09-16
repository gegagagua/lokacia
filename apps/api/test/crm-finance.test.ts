import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmDeals } from '@lokacia/db';
import { createApp, loginAs } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

describe('CRM deal finance & lead source ROI (C18, C19)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let manager: Awaited<ReturnType<typeof crmLogin>>;
  let orgId: string;
  beforeAll(async () => {
    ctx = await createApp();
    const owner = await loginAs(ctx.app, '+995599600600');
    orgId = (await owner.post('/v1/orgs').send({ name: 'ROI ტესტ', type: 'agency' })).body.id;
    manager = await crmLogin(ctx.app, '+995599600600', orgId);
  });
  afterAll(async () => ctx.app.close());

  it('calculates commission, agent and agency shares', async () => {
    const res = await manager.post('/v1/crm/finance/calculate').send({ valueMinor: 3_600_000, commissionPct: 8.33, agentSharePct: 60 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ commissionMinor: 299_880, agentMinor: 179_928, agencyMinor: 119_952 });
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.post('/v1/crm/finance/calculate').send({ valueMinor: 1, commissionPct: 1, agentSharePct: 1 })).status).toBe(403);
    expect((await assistant.get('/v1/crm/sources/roi')).status).toBe(403);
    const src = await assistant.get('/v1/crm/sources');
    expect(src.status).toBe(200);
    expect(src.body.every((s: { monthlyCostMinor: number | null }) => s.monthlyCostMinor === null)).toBe(true);
  });

  it('computes ROI per source from won commission vs monthly cost', async () => {
    const created = await manager.post('/v1/crm/sources').send({ key: 'test_ads', name: 'ტესტ რეკლამა', monthlyCostMinor: 50_000 });
    expect(created.status).toBe(201);
    expect((await manager.post('/v1/crm/sources').send({ key: 'test_ads', name: 'დუბლი' })).status).toBe(409);
    const patched = await manager.patch(`/v1/crm/sources/${created.body.id}`).send({ monthlyCostMinor: 50_000 });
    expect(patched.body.name).toBe('ტესტ რეკლამა');
    const pipelineId = (await manager.get('/v1/crm/pipelines/default')).body.id as string;
    await sys(ctx.db, async (tx) => {
      const cs = await tx.insert(crmContacts).values([0, 1, 2, 3].map((i) => ({ orgId, name: `ROI ${i}`, source: 'test_ads' }))).returning();
      await tx.insert(crmDeals).values([
        { orgId, pipelineId, contactId: cs[0]!.id, title: 'won', stage: 'won', source: 'test_ads', valueMinor: 4_000_000, commissionMinor: 400_000, closedAt: new Date() },
        { orgId, pipelineId, contactId: cs[1]!.id, title: 'open', stage: 'lead', source: 'test_ads', valueMinor: 1_000_000, commissionMinor: 100_000 },
      ]);
    });
    const roi = await manager.get('/v1/crm/sources/roi?months=6');
    expect(roi.status).toBe(200);
    const row = roi.body.items.find((i: { key: string }) => i.key === 'test_ads');
    expect(row).toMatchObject({ leads: 4, deals: 2, won: 1, wonCommissionMinor: 400_000, costMinor: 300_000, roiPct: 33.3, costPerLeadMinor: 75_000, conversionPct: 25 });
    const summary = await manager.get('/v1/crm/finance/summary');
    expect(summary.body.openCommissionMinor).toBe(100_000);
    expect((await manager.delete(`/v1/crm/sources/${created.body.id}`)).status).toBe(200);
  });

  it('deal PATCH updates finance via the calculator formula', async () => {
    const [c] = await sys(ctx.db, (tx) => tx.insert(crmContacts).values({ orgId, name: 'ფინანსები' }).returning());
    const d = await manager.post('/v1/crm/deals').send({ contactId: c!.id, title: 'ფინანსები', valueMinor: 1_000_000, commissionPct: 10, agentSharePct: 50 });
    expect(d.body.finance).toMatchObject({ commissionMinor: 100_000, agentMinor: 50_000, agencyMinor: 50_000, probabilityPct: 10, expectedMinor: 10_000 });
    const p = await manager.patch(`/v1/crm/deals/${d.body.id}`).send({ commissionPct: 5, agentSharePct: 30 });
    expect(p.body.finance).toMatchObject({ commissionMinor: 50_000, agentMinor: 15_000, agencyMinor: 35_000 });
  });
});
