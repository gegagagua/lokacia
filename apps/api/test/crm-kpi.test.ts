import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmDeals } from '@lokacia/db';
import { createApp, loginAs } from './helpers';
import { crmLogin, sys } from './crm-helpers';

const D = (s: string) => new Date(`${s}T12:00:00Z`);

describe('CRM KPI dashboard numbers (C20)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let manager: Awaited<ReturnType<typeof crmLogin>>;
  let agent: Awaited<ReturnType<typeof crmLogin>>;
  let orgId: string;
  const period = 'from=2026-01-01T00:00:00Z&to=2026-03-31T23:59:59Z';

  beforeAll(async () => {
    ctx = await createApp();
    const owner = await loginAs(ctx.app, '+995599500500');
    orgId = (await owner.post('/v1/orgs').send({ name: 'KPI ტესტ', type: 'agency' })).body.id;
    await loginAs(ctx.app, '+995599500501');
    await owner.post('/v1/orgs/current/invites').set('x-org-id', orgId).send({ phone: '+995599500501', role: 'agent' });
    manager = await crmLogin(ctx.app, '+995599500500', orgId);
    agent = await crmLogin(ctx.app, '+995599500501', orgId);
    await manager.patch('/v1/crm/team/settings').send({ leadDistribution: 'manual' });
    const pipelineId = (await manager.get('/v1/crm/pipelines/default')).body.id as string;
    const m = manager.user.id;
    const a = agent.user.id;
    await sys(ctx.db, async (tx) => {
      const [c] = await tx.insert(crmContacts).values({ orgId, name: 'KPI კლიენტი', createdAt: D('2026-01-02') }).returning();
      const deal = (title: string, agentId: string, stage: string, created: string, closed: string | null, value: number, commission = Math.round(value / 10)) => ({
        orgId, pipelineId, contactId: c!.id, title, agentId, stage, valueMinor: value, commissionMinor: commission, createdAt: D(created), closedAt: closed ? D(closed) : null,
      });
      await tx.insert(crmDeals).values([
        deal('W1', m, 'won', '2026-01-01', '2026-01-11', 1_000_000),
        deal('W2', a, 'won', '2026-02-01', '2026-02-21', 3_000_000),
        deal('W3', a, 'won', '2026-02-10', '2026-03-10', 500_000),
        deal('L1', m, 'lost', '2026-01-05', '2026-01-20', 700_000),
        deal('L2', a, 'lost', '2026-03-01', '2026-03-05', 800_000),
        deal('O1', m, 'lead', '2026-03-15', null, 2_000_000),
        deal('O2', a, 'offer', '2025-12-01', null, 400_000),
        deal('W0', m, 'won', '2025-10-01', '2025-11-01', 9_000_000),
      ]);
    });
  });
  afterAll(async () => ctx.app.close());

  it('computes org KPIs for the period', async () => {
    const res = await manager.get(`/v1/crm/analytics/kpi?${period}`);
    expect(res.status).toBe(200);
    const k = res.body;
    expect(k.scope).toBe('org');
    expect(k.totals).toMatchObject({ openDeals: 2, wonCount: 3, lostCount: 2, winRatePct: 60, leadToWonPct: 50, avgCycleDays: 19.3, wonValueMinor: 4_500_000, wonCommissionMinor: 450_000, pipelineValueMinor: 2_400_000, newContacts: 1, newDeals: 6 });
    const stage = (key: string) => k.byStage.find((s: { key: string }) => s.key === key);
    expect(stage('lead')).toMatchObject({ count: 1, valueMinor: 2_000_000 });
    expect(stage('offer').count).toBe(1);
    expect(stage('won').count).toBe(3);
    expect(stage('lost').count).toBe(2);
    expect(k.ranking.map((r: { agentId: string }) => r.agentId)).toEqual([agent.user.id, manager.user.id]);
    expect(k.ranking[0]).toMatchObject({ wonCount: 2, lostCount: 1, wonCommissionMinor: 350_000, conversionPct: 66.7, openDeals: 1 });
    expect(k.ranking[1]).toMatchObject({ wonCount: 1, lostCount: 1, wonCommissionMinor: 100_000, conversionPct: 50 });
    expect(k.monthly.map((x: { month: string }) => x.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    expect(k.monthly.map((x: { wonCount: number }) => x.wonCount)).toEqual([0, 1, 0, 1, 1, 1]);
    expect(k.monthly[1].wonValueMinor).toBe(9_000_000);
  });

  it('filters by agent and scopes agents to their own numbers', async () => {
    const filtered = (await manager.get(`/v1/crm/analytics/kpi?${period}&agentId=${manager.user.id}`)).body;
    expect(filtered.totals).toMatchObject({ wonCount: 1, lostCount: 1, winRatePct: 50, avgCycleDays: 10 });
    const own = (await agent.get(`/v1/crm/analytics/kpi?${period}&agentId=${manager.user.id}`)).body;
    expect(own.scope).toBe('own');
    expect(own.totals).toMatchObject({ wonCount: 2, lostCount: 1, wonCommissionMinor: 350_000, openDeals: 1 });
    expect(own.ranking).toHaveLength(1);
  });
});
