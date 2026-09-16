import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmActivities, crmContacts, eq, and } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES, sys } from './crm-helpers';

type Card = { id: string; stage: string; position: number; agentId: string | null; valueMinor: number | null };

describe('CRM deals kanban & pipeline (C3)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let manager: Awaited<ReturnType<typeof crmLogin>>;
  let contactId: string;
  beforeAll(async () => {
    ctx = await createApp();
    manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [c] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(and(eq(crmContacts.orgId, manager.orgId), eq(crmContacts.type, 'client'))).limit(1));
    contactId = c!.id;
  });
  afterAll(async () => ctx.app.close());

  const board = async (a = manager) => (await a.get('/v1/crm/deals')).body as { deals: Card[]; financeVisible: boolean; pipeline: { stages: { key: string }[] } };
  const create = async (title: string, extra: Record<string, unknown> = {}) => {
    const res = await manager.post('/v1/crm/deals').send({ contactId, title, valueMinor: 1_200_000, commissionPct: 10, agentSharePct: 40, agentId: manager.user.id, ...extra });
    expect(res.status).toBe(201);
    return res.body as Card & { commissionMinor: number; finance: { agentMinor: number; agencyMinor: number } };
  };

  it('creates a deal in the first open stage at the end of the column with commission computed', async () => {
    const before = (await board()).deals.filter((d) => d.stage === 'lead').map((d) => d.position);
    const d = await create('ტესტ — კაფე ვაკეში');
    expect(d.stage).toBe('lead');
    expect(d.position).toBe(Math.max(-1, ...before) + 1);
    expect(d.commissionMinor).toBe(120_000);
    expect(d.finance).toMatchObject({ agentMinor: 48_000, agencyMinor: 72_000 });
  });

  it('moves cards between stages and renumbers positions in both columns', async () => {
    const a = await create('A');
    const b = await create('B');
    expect((await manager.post(`/v1/crm/deals/${a.id}/move`).send({ stage: 'viewing', position: 0 })).status).toBe(200);
    expect((await manager.post(`/v1/crm/deals/${b.id}/move`).send({ stage: 'viewing', position: 0 })).status).toBe(200);
    const deals = (await board()).deals;
    const viewing = deals.filter((d) => d.stage === 'viewing').sort((x, y) => x.position - y.position);
    expect(viewing[0]!.id).toBe(b.id);
    expect(viewing[1]!.id).toBe(a.id);
    for (const stage of ['lead', 'viewing']) {
      const col = deals.filter((d) => d.stage === stage).map((d) => d.position).sort((x, y) => x - y);
      expect(col).toEqual(col.map((_, i) => i));
    }
    // reorder inside the same column
    await manager.post(`/v1/crm/deals/${a.id}/move`).send({ stage: 'viewing', position: 0 });
    const again = (await board()).deals.filter((d) => d.stage === 'viewing').sort((x, y) => x.position - y.position);
    expect(again[0]!.id).toBe(a.id);
  });

  it('requires a lost reason, records closedAt and a stage_change activity, reopening clears closedAt', async () => {
    const d = await create('წაგების ტესტ');
    const noReason = await manager.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'lost', position: 0 });
    expect(noReason.status).toBe(422);
    const ok = await manager.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'lost', position: 0, lostReason: 'ბიუჯეტი არ ეყო' });
    expect(ok.status).toBe(200);
    expect(ok.body.closedAt).toBeTruthy();
    expect(ok.body.lostReason).toBe('ბიუჯეტი არ ეყო');
    const acts = await sys(ctx.db, (tx) => tx.select().from(crmActivities).where(and(eq(crmActivities.entityId, d.id), eq(crmActivities.type, 'stage_change'))));
    expect(acts.some((a) => a.payload.to === 'lost' && a.payload.lostReason === 'ბიუჯეტი არ ეყო')).toBe(true);
    const reopened = await manager.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'lead', position: 0 });
    expect(reopened.body.closedAt).toBeNull();
    expect(reopened.body.lostReason).toBeNull();
    const won = await manager.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'won', position: 0 });
    expect(won.body.closedAt).toBeTruthy();
    expect(won.body.stageHistory.map((h: { to: string }) => h.to)).toEqual(['lead', 'lost', 'lead', 'won']);
  });

  it('PATCH recomputes commission and keeps unsent fields', async () => {
    const d = await create('PATCH ტესტ');
    const res = await manager.patch(`/v1/crm/deals/${d.id}`).send({ valueMinor: 2_000_000 });
    expect(res.status).toBe(200);
    expect(res.body.commissionMinor).toBe(200_000);
    expect(res.body.agentSharePct).toBe(40);
    expect(res.body.title).toBe('PATCH ტესტ');
  });

  it('agents only see their own deals', async () => {
    const d = await create('მენეჯერის გარიგება');
    const agent = await crmLogin(ctx.app, PHONES.agent);
    expect((await agent.get(`/v1/crm/deals/${d.id}`)).status).toBe(404);
    expect((await agent.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'offer', position: 0 })).status).toBe(404);
    const b = await board(agent);
    expect(b.deals.length).toBeGreaterThan(0);
    expect(b.deals.every((x) => x.agentId === agent.user.id)).toBe(true);
    // agent-created deal is assigned to the agent
    const own = await agent.post('/v1/crm/deals').send({ contactId, title: 'აგენტის გარიგება', agentId: manager.user.id });
    expect(own.status).toBe(201);
    expect(own.body.agentId).toBe(agent.user.id);
  });

  it('assistants see all deals but no finance and cannot delete', async () => {
    const d = await create('წაშლის ტესტ');
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    const b = await board(assistant);
    expect(b.financeVisible).toBe(false);
    expect(b.deals.every((x) => x.valueMinor === null)).toBe(true);
    expect(b.deals.some((x) => x.id === d.id)).toBe(true);
    const detail = await assistant.get(`/v1/crm/deals/${d.id}`);
    expect(detail.body.finance).toBeNull();
    expect((await assistant.patch(`/v1/crm/deals/${d.id}`).send({ valueMinor: 1 })).status).toBe(403);
    expect((await assistant.delete(`/v1/crm/deals/${d.id}`)).status).toBe(403);
    expect((await manager.delete(`/v1/crm/deals/${d.id}`)).status).toBe(200);
    expect((await manager.get(`/v1/crm/deals/${d.id}`)).status).toBe(404);
  });

  it('denies cross-org access', async () => {
    const d = await create('სხვა ორგანიზაცია');
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const cityspaces = await orgIdBySlug(ctx.db, 'city-spaces');
    expect((await other.get('/v1/crm/deals').set('x-org-id', cityspaces)).status).toBe(403);
    expect((await other.get(`/v1/crm/deals/${d.id}`)).status).toBe(404);
    expect((await other.post(`/v1/crm/deals/${d.id}/move`).send({ stage: 'won', position: 0 })).status).toBe(404);
    const theirs = await board(other);
    expect(theirs.deals.some((x) => x.id === d.id)).toBe(false);
    expect((await other.post('/v1/crm/deals').send({ contactId, title: 'x' })).status).toBe(404);
  });

  it('validates and updates pipeline stages (manager only)', async () => {
    const p = (await manager.get('/v1/crm/pipelines/default')).body as { stages: { key: string; name: string; kind: string; dealsCount: number }[] };
    const stages = p.stages.map(({ key, name, kind }) => ({ key, name, kind }));
    const twoWon = stages.map((s) => (s.key === 'contract' ? { ...s, kind: 'won' } : s));
    expect((await manager.put('/v1/crm/pipelines/default').send({ stages: twoWon })).status).toBe(422);
    const dupKey = [...stages, { key: 'lead', name: 'x', kind: 'open' }];
    expect((await manager.put('/v1/crm/pipelines/default').send({ stages: dupKey })).status).toBe(422);
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.put('/v1/crm/pipelines/default').send({ stages })).status).toBe(403);

    const renamed = stages.map((s) => (s.key === 'offer' ? { ...s, name: 'მოლაპარაკება' } : s));
    const withNew = [...renamed.slice(0, 1), { key: 'qualified', name: 'კვალიფიცირებული', kind: 'open' }, ...renamed.slice(1)];
    const ok = await manager.put('/v1/crm/pipelines/default').send({ stages: withNew });
    expect(ok.status).toBe(200);
    expect(ok.body.stages.map((s: { key: string }) => s.key)).toEqual(['lead', 'qualified', 'viewing', 'offer', 'contract', 'won', 'lost']);
    expect(ok.body.stages.find((s: { key: string }) => s.key === 'offer').name).toBe('მოლაპარაკება');

    const withoutViewing = withNew.filter((s) => s.key !== 'viewing');
    const needMove = await manager.put('/v1/crm/pipelines/default').send({ stages: withoutViewing });
    expect(needMove.status).toBe(422);
    const moved = await manager.put('/v1/crm/pipelines/default').send({ stages: withoutViewing, moveTo: { viewing: 'qualified' } });
    expect(moved.status).toBe(200);
    const deals = (await board()).deals;
    expect(deals.some((d) => d.stage === 'viewing')).toBe(false);
    expect(deals.some((d) => d.stage === 'qualified')).toBe(true);
  });
});
