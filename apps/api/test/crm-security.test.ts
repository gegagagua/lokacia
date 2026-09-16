import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { and, conversations, crmContacts, crmDeals, crmSequenceRuns, crmSequences, documents, eq, isNull, listings, memberships, ne, organizations, users } from '@lokacia/db';
import { ENV, type Env } from '../src/config/env';
import { buildWorkbook, csvSafe } from '../src/modules/crm/imports/spreadsheet';
import { createApp } from './helpers';
import { crmLogin, orgIdBySlug, PHONES, sys } from './crm-helpers';

type Agent = Awaited<ReturnType<typeof crmLogin>>;

describe('CRM security regressions (audit H1–L4)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let manager: Agent;
  let agent: Agent;
  let assistant: Agent;
  beforeAll(async () => {
    ctx = await createApp();
    manager = await crmLogin(ctx.app, PHONES.agencyManager);
    agent = await crmLogin(ctx.app, PHONES.agent);
    assistant = await crmLogin(ctx.app, PHONES.assistant);
  });
  afterAll(async () => ctx.app.close());

  /** A live contact / deal of the org that belongs to the manager (never visible to the agent). */
  const foreignContact = async () => (await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(and(eq(crmContacts.orgId, manager.orgId), eq(crmContacts.ownerAgentId, manager.user.id), isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId))).limit(1)))[0]!;
  const ownContact = async () => (await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(and(eq(crmContacts.orgId, agent.orgId), eq(crmContacts.ownerAgentId, agent.user.id), isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId))).limit(1)))[0]!;
  const foreignDeal = async () => (await sys(ctx.db, (tx) => tx.select().from(crmDeals).where(and(eq(crmDeals.orgId, manager.orgId), eq(crmDeals.agentId, manager.user.id), isNull(crmDeals.deletedAt))).limit(1)))[0]!;
  const ownDeal = async () => (await sys(ctx.db, (tx) => tx.select().from(crmDeals).where(and(eq(crmDeals.orgId, agent.orgId), eq(crmDeals.agentId, agent.user.id), isNull(crmDeals.deletedAt))).limit(1)))[0]!;

  it('H1: e-sign links are unguessable, single-use and expire', async () => {
    const deal = await foreignDeal();
    const doc = await manager.post('/v1/crm/documents').send({ template: 'act', dealId: deal.id, fields: {} });
    expect(doc.status).toBe(201);
    const sent = await manager.post(`/v1/crm/documents/${doc.body.id}/send`).send({ signerName: 'ნინო ბერიძე' });
    expect(sent.status).toBe(200);
    expect(sent.body.signRef).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sent.body.signRef).not.toContain(doc.body.id);
    // the old predictable ref format is rejected
    expect((await ctx.http().post(`/v1/crm/documents/sign/mock-sign-${doc.body.id}`).send({ decision: 'sign', name: 'ხაკერი' })).status).toBe(404);
    expect((await ctx.http().get(`/v1/crm/documents/sign/mock-sign-${doc.body.id}`)).status).toBe(404);
    // seeded legacy link (no signSentAt) no longer works either
    expect((await ctx.http().get('/v1/crm/documents/sign/mock-sign-2')).status).toBe(404);
    const ok = await ctx.http().post(`/v1/crm/documents/sign/${sent.body.signRef}`).send({ decision: 'sign', name: 'ნინო ბერიძე' });
    expect(ok.status).toBe(200);
    expect(ok.body.signStatus).toBe('signed');
    const again = await ctx.http().post(`/v1/crm/documents/sign/${sent.body.signRef}`).send({ decision: 'decline', name: 'ნინო ბერიძე' });
    expect([404, 409]).toContain(again.status);
    const [row] = await sys(ctx.db, (tx) => tx.select().from(documents).where(eq(documents.id, doc.body.id)));
    expect(row!.signStatus).toBe('signed');
    // after the decision window the link is dead even for viewing
    await sys(ctx.db, (tx) => tx.update(documents).set({ content: { ...(row!.content as object), signClosedAt: new Date(Date.now() - 2 * 3600_000).toISOString() } }).where(eq(documents.id, doc.body.id)));
    expect((await ctx.http().get(`/v1/crm/documents/sign/${sent.body.signRef}`)).status).toBe(404);

    // expiry: a link sent 15 days ago cannot be used
    const doc2 = await manager.post('/v1/crm/documents').send({ template: 'act', fields: {} });
    const sent2 = await manager.post(`/v1/crm/documents/${doc2.body.id}/send`).send({ signerName: 'გიო' });
    const [row2] = await sys(ctx.db, (tx) => tx.select().from(documents).where(eq(documents.id, doc2.body.id)));
    await sys(ctx.db, (tx) => tx.update(documents).set({ content: { ...(row2!.content as object), signSentAt: new Date(Date.now() - 15 * 86_400_000).toISOString() } }).where(eq(documents.id, doc2.body.id)));
    expect((await ctx.http().post(`/v1/crm/documents/sign/${sent2.body.signRef}`).send({ decision: 'sign', name: 'გიო გიო' })).status).toBe(410);
  });

  it('H2: agents only see inbox conversations of their own contacts', async () => {
    const sim = await manager.post('/v1/crm/inbox/simulate').send({ channel: 'whatsapp', from: '+995599310001', name: 'სხვის კლიენტი', text: 'საიდუმლო შეტყობინება' });
    expect(sim.status).toBe(201);
    await sys(ctx.db, (tx) => tx.update(crmContacts).set({ ownerAgentId: manager.user.id }).where(eq(crmContacts.id, sim.body.contactId)));
    const id = sim.body.conversationId as string;
    const list = await agent.get('/v1/crm/inbox');
    expect(list.status).toBe(200);
    expect(list.body.map((c: { id: string }) => c.id)).not.toContain(id);
    expect((await agent.get(`/v1/crm/inbox/${id}`)).status).toBe(404);
    expect((await agent.get(`/v1/crm/inbox/${id}/messages`)).status).toBe(404);
    expect((await agent.post(`/v1/crm/inbox/${id}/messages`).send({ body: 'x' })).status).toBe(404);
    expect((await agent.post(`/v1/crm/inbox/${id}/link`).send({ contactId: (await ownContact()).id })).status).toBe(404);
    // manager still sees it; once assigned to the agent the agent does too
    expect((await manager.get(`/v1/crm/inbox/${id}`)).status).toBe(200);
    await sys(ctx.db, (tx) => tx.update(crmContacts).set({ ownerAgentId: agent.user.id }).where(eq(crmContacts.id, sim.body.contactId)));
    expect((await agent.get('/v1/crm/inbox')).body.map((c: { id: string }) => c.id)).toContain(id);
    const msgs = await agent.get(`/v1/crm/inbox/${id}/messages`);
    expect(msgs.status).toBe(200);
    // agent cannot re-link the conversation to someone else's contact
    expect((await agent.post(`/v1/crm/inbox/${id}/link`).send({ contactId: (await foreignContact()).id })).status).toBe(404);
    const [conv] = await ctx.db.select().from(conversations).where(eq(conversations.id, id));
    expect(conv!.contactId).toBe(sim.body.contactId);
  });

  it('H3: activity timeline requires record visibility', async () => {
    const other = await foreignContact();
    const mine = await ownContact();
    expect((await agent.get(`/v1/crm/activities?entity=contact&entityId=${other.id}`)).status).toBe(404);
    expect((await agent.post('/v1/crm/activities').send({ entity: 'contact', entityId: other.id, type: 'note', payload: { body: 'x' } })).status).toBe(404);
    expect((await agent.get(`/v1/crm/activities?entity=deal&entityId=${(await foreignDeal()).id}`)).status).toBe(404);
    expect((await agent.post('/v1/crm/calls').send({ entityId: other.id, phone: '555', outcome: 'answered' })).status).toBe(404);
    expect((await agent.get(`/v1/crm/activities?entity=contact&entityId=${mine.id}`)).status).toBe(200);
    expect((await agent.post('/v1/crm/activities').send({ entity: 'contact', entityId: mine.id, type: 'note', payload: { body: 'ok' } })).status).toBe(201);
    expect((await manager.get(`/v1/crm/activities?entity=contact&entityId=${other.id}`)).status).toBe(200);
    // listings of another org
    const orgB = await orgIdBySlug(ctx.db, 'business-lokacia');
    const [foreignListing] = await ctx.db.select().from(listings).where(eq(listings.orgId, orgB)).limit(1);
    expect((await manager.get(`/v1/crm/activities?entity=listing&entityId=${foreignListing!.id}`)).status).toBe(404);
  });

  it("M1: agents cannot attach other agents' contacts/deals to their records", async () => {
    const other = await foreignContact();
    const mine = await ownContact();
    const otherDeal = await foreignDeal();
    const myDeal = await ownDeal();
    // deals
    expect((await agent.post('/v1/crm/deals').send({ title: 'PII leak', contactId: other.id })).status).toBe(404);
    expect((await agent.patch(`/v1/crm/deals/${myDeal.id}`).send({ contactId: other.id })).status).toBe(404);
    const okDeal = await agent.post('/v1/crm/deals').send({ title: 'ჩემი გარიგება', contactId: mine.id });
    expect(okDeal.status).toBe(201);
    // tasks
    expect((await agent.post('/v1/crm/tasks').send({ title: 'x', dealId: otherDeal.id })).status).toBe(404);
    expect((await agent.post('/v1/crm/tasks').send({ title: 'x', contactId: other.id })).status).toBe(404);
    const t = await agent.post('/v1/crm/tasks').send({ title: 'ჩემი', contactId: mine.id });
    expect(t.status).toBe(201);
    expect((await agent.patch(`/v1/crm/tasks/${t.body.id}`).send({ contactId: other.id })).status).toBe(404);
    expect((await agent.patch(`/v1/crm/tasks/${t.body.id}`).send({ dealId: otherDeal.id })).status).toBe(404);
    // viewings / presentations
    expect((await agent.post('/v1/crm/viewings').send({ contactId: other.id, startsAt: '2026-12-01T10:00:00+04:00' })).status).toBe(404);
    expect((await agent.post('/v1/crm/viewings').send({ dealId: otherDeal.id, startsAt: '2026-12-01T10:00:00+04:00' })).status).toBe(404);
    const [l] = await ctx.db.select().from(listings).where(and(eq(listings.orgId, agent.orgId), eq(listings.status, 'active'))).limit(1);
    expect((await agent.post('/v1/crm/presentations').send({ title: 'x y', contactId: other.id, listingIds: [l!.id] })).status).toBe(404);
    // sequences: cannot stop a run of someone else's contact
    const [seq] = await sys(ctx.db, (tx) => tx.select().from(crmSequences).where(eq(crmSequences.orgId, manager.orgId)).limit(1));
    const [run] = await sys(ctx.db, (tx) => tx.insert(crmSequenceRuns).values({ orgId: manager.orgId, sequenceId: seq!.id, contactId: other.id, step: 0, nextAt: new Date(Date.now() + 86_400_000), status: 'running' }).returning());
    expect((await agent.post(`/v1/crm/sequences/runs/${run!.id}/stop`)).status).toBe(404);
    // contact detail lists only the agent's own deals
    const managerDeal = await manager.post('/v1/crm/deals').send({ title: 'მენეჯერის გარიგება', contactId: mine.id, agentId: manager.user.id });
    expect(managerDeal.status).toBe(201);
    const detail = await agent.get(`/v1/crm/contacts/${mine.id}`);
    expect(detail.body.deals.map((d: { id: string }) => d.id)).not.toContain(managerDeal.body.id);
    expect((await manager.get(`/v1/crm/contacts/${mine.id}`)).body.deals.map((d: { id: string }) => d.id)).toContain(managerDeal.body.id);
  });

  it('M2: documents are scoped for agents and finance fields hidden without finance.view', async () => {
    const otherDeal = await foreignDeal();
    const doc = await manager.post('/v1/crm/documents').send({ template: 'exclusivity', dealId: otherDeal.id, fields: {} });
    expect(doc.status).toBe(201);
    expect((await agent.get('/v1/crm/documents')).body.map((d: { id: string }) => d.id)).not.toContain(doc.body.id);
    expect((await agent.get(`/v1/crm/documents/${doc.body.id}`)).status).toBe(404);
    expect((await agent.get(`/v1/crm/documents/${doc.body.id}/pdf`)).status).toBe(404);
    expect((await agent.post('/v1/crm/documents').send({ template: 'act', dealId: otherDeal.id, fields: {} })).status).toBe(404);
    expect((await manager.get(`/v1/crm/documents/${doc.body.id}`)).status).toBe(200);
    // assistant (no finance.view): deal value / commission never filled in
    const byAssistant = await assistant.post('/v1/crm/documents').send({ template: 'exclusivity', dealId: otherDeal.id, fields: {} });
    expect(byAssistant.status).toBe(201);
    expect(byAssistant.body.fields.dealValue).toBeUndefined();
    expect(byAssistant.body.fields.commissionPct).toBeUndefined();
    const [stored] = await sys(ctx.db, (tx) => tx.select().from(documents).where(eq(documents.id, byAssistant.body.id)));
    expect((stored!.content as { fields: Record<string, unknown> }).fields.dealValue).toBe('');
    expect((await assistant.get(`/v1/crm/documents/${doc.body.id}`)).body.fields.dealValue).toBeUndefined();
    expect((await manager.get(`/v1/crm/documents/${doc.body.id}`)).body.fields.dealValue).toBeTruthy();
  });

  it("M3: presentations and deals cannot reference other orgs' non-public listings", async () => {
    const orgB = await orgIdBySlug(ctx.db, 'business-lokacia');
    const [hidden] = await ctx.db.select().from(listings).where(and(eq(listings.orgId, orgB), ne(listings.status, 'active'), isNull(listings.deletedAt))).limit(1);
    const [publicB] = await ctx.db.select().from(listings).where(and(eq(listings.orgId, orgB), eq(listings.status, 'active'), isNull(listings.deletedAt))).limit(1);
    const mine = await ownContact();
    expect((await manager.post('/v1/crm/presentations').send({ title: 'leak', listingIds: [hidden!.id] })).status).toBe(400);
    expect((await manager.post('/v1/crm/deals').send({ title: 'leak', contactId: mine.id, listingId: hidden!.id })).status).toBe(404);
    const p = await manager.post('/v1/crm/presentations').send({ title: 'ok', listingIds: [publicB!.id] });
    expect(p.status).toBe(201);
    // the public page re-checks: once the foreign listing is no longer active it disappears
    await ctx.db.update(listings).set({ status: 'stale' }).where(eq(listings.id, publicB!.id));
    try {
      const view = await ctx.http().get(`/v1/crm/presentations/public/${p.body.token}`);
      expect(view.status).toBe(200);
      expect(view.body.listings.map((l: { id: string }) => l.id)).not.toContain(publicB!.id);
    } finally {
      await ctx.db.update(listings).set({ status: 'active' }).where(eq(listings.id, publicB!.id));
    }
  });

  it('M4: CSV export neutralizes formula cells', async () => {
    expect(csvSafe('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(csvSafe('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(csvSafe('-2+3+cmd|x')).toBe(`'-2+3+cmd|x`);
    expect(csvSafe('\tfoo')).toBe(`'\tfoo`);
    expect(csvSafe('+995 555 12 34 56')).toBe('+995 555 12 34 56');
    expect(csvSafe('გიორგი')).toBe('გიორგი');
    expect(csvSafe(-5)).toBe(-5);
    const csv = (await buildWorkbook('x', ['name'], [['=1+1'], ['ok']], 'csv')).toString('utf8');
    expect(csv).toContain(`'=1+1`);
    expect(csv).not.toMatch(/^=1\+1/m);
  });

  it('M5: public feed publishes only the organization phone', async () => {
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, orgId));
    const res = await ctx.http().get(`/v1/feeds/${orgId}.xml`);
    expect(res.status).toBe(200);
    const xml = res.text;
    const people = await ctx.db.select({ phone: users.phone }).from(listings).innerJoin(users, eq(users.id, listings.agentId)).where(and(eq(listings.orgId, orgId), eq(listings.status, 'active')));
    const owners = await ctx.db.select({ phone: users.phone }).from(listings).innerJoin(users, eq(users.id, listings.ownerId)).where(and(eq(listings.orgId, orgId), eq(listings.status, 'active')));
    const phones = [...new Set([...people, ...owners].map((p) => p.phone).filter((p): p is string => !!p))];
    expect(phones.length).toBeGreaterThan(0);
    for (const phone of phones) expect(xml).not.toContain(phone);
    expect(xml).toContain(`<phone>${org!.phone}</phone>`);
  });

  it('M6: ICS feed uses a domain-separated key and dies with the membership', async () => {
    const env = ctx.app.get<Env>(ENV);
    const { body } = await agent.get('/v1/crm/calendar/feed-url');
    const path = new URL(body.url).pathname;
    expect((await ctx.http().get(path)).status).toBe(200);
    // the old token (HMAC keyed directly with the refresh secret) is rejected
    const legacy = `${agent.user.id}.${agent.orgId}.${createHmac('sha256', env.JWT_REFRESH_SECRET).update(`ics:${agent.user.id}:${agent.orgId}`).digest('hex').slice(0, 32)}`;
    expect((await ctx.http().get(`/v1/crm/calendar/${legacy}.ics`)).status).toBe(404);
    const [m] = await ctx.db.select().from(memberships).where(and(eq(memberships.orgId, agent.orgId), eq(memberships.userId, agent.user.id)));
    await ctx.db.update(memberships).set({ active: false }).where(eq(memberships.id, m!.id));
    try {
      expect((await ctx.http().get(path)).status).toBe(404);
    } finally {
      await ctx.db.update(memberships).set({ active: true }).where(eq(memberships.id, m!.id));
    }
    await ctx.db.update(memberships).set({ deletedAt: new Date() }).where(eq(memberships.id, m!.id));
    try {
      expect((await ctx.http().get(path)).status).toBe(404);
    } finally {
      await ctx.db.update(memberships).set({ deletedAt: null }).where(eq(memberships.id, m!.id));
    }
    expect((await ctx.http().get(path)).status).toBe(200);
  });

  it('L1: webhook secret compared safely; simulate refused in production', async () => {
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    const send = (secret?: string) => {
      const r = ctx.http().post('/v1/crm/inbox/webhooks/viber');
      return (secret === undefined ? r : r.set('x-lk-webhook', secret)).send({ orgId, from: '+995599310002', text: 'x' });
    };
    expect((await send('de')).status).toBe(403);
    expect((await send('devv')).status).toBe(403);
    expect((await send()).status).toBe(403);
    expect((await send('dev')).status).toBe(200);
    const env = ctx.app.get<Env>(ENV);
    const prev = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    try {
      expect((await manager.post('/v1/crm/inbox/simulate').send({ channel: 'whatsapp', from: '+995599310003', text: 'fake' })).status).toBe(404);
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = prev;
    }
  });

  it('L2: new portal tokens are 256-bit; merge revokes the duplicates’ portal links', async () => {
    const a = await manager.post('/v1/crm/contacts').send({ type: 'client', name: 'მერჯ სამიზნე', phones: ['+995599310010'] });
    const b = await manager.post('/v1/crm/contacts').send({ type: 'client', name: 'მერჯ დუბლიკატი', phones: ['+995599310011'] });
    expect(a.status).toBe(201);
    expect(a.body.portalToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const sourceToken = b.body.portalToken as string;
    expect((await ctx.http().get(`/v1/crm/portal/${sourceToken}`)).status).toBe(200);
    const merged = await manager.post('/v1/crm/contacts/merge').send({ targetId: a.body.id, sourceIds: [b.body.id] });
    expect(merged.status).toBe(200);
    const [src] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, b.body.id)));
    expect(src!.portalToken).toBeNull();
    const [dst] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.id, a.body.id)));
    expect(dst!.portalToken).toBe(a.body.portalToken);
    expect((await ctx.http().get(`/v1/crm/portal/${sourceToken}`)).status).toBe(404);
  });

  it('L4: KPI analytics requires analytics.view', async () => {
    expect((await assistant.get('/v1/crm/analytics/kpi')).status).toBe(403);
    expect((await agent.get('/v1/crm/analytics/kpi')).status).toBe(200);
    expect((await manager.get('/v1/crm/analytics/kpi')).status).toBe(200);
  });

  // keep last: exhausts the per-IP bucket of this app instance
  it('H1: public sign endpoint is rate-limited per IP', async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) last = (await ctx.http().post(`/v1/crm/documents/sign/${'a'.repeat(43)}`).send({ decision: 'sign', name: 'ab' })).status;
    expect(last).toBe(429);
  });
});
