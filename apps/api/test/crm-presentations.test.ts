import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, listings, notifications } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES } from './crm-helpers';

describe('C10 branded presentations', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('creates a link, tracks the first open with a notification, exports PDF and isolates orgs', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const ls = await ctx.db.select({ id: listings.id }).from(listings).where(eq(listings.status, 'active')).limit(3);
    const created = await agent.post('/v1/crm/presentations').send({ title: 'ოფისები ვაკეში', message: 'შერჩეული ვარიანტები', listingIds: ls.map((l) => l.id) });
    expect(created.status).toBe(201);
    expect(created.body.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(created.body.openCount).toBe(0);

    const pub = await ctx.http().get(`/v1/crm/presentations/public/${created.body.token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.listings).toHaveLength(3);
    expect(pub.body.org.name).toBeTruthy();
    expect(pub.body.agent.name).toBeTruthy();
    expect(pub.body.listings[0].portalUrl).toMatch(/\/listings\//);

    const notifCount = async () => (await ctx.db.select().from(notifications).where(and(eq(notifications.userId, agent.user.id), eq(notifications.template, 'crm_presentation_opened')))).length;
    const before = await notifCount();
    const first = await ctx.http().post(`/v1/crm/presentations/public/${created.body.token}/open`);
    expect(first.body).toMatchObject({ openCount: 1, first: true });
    expect(first.body.openedAt).toBeTruthy();
    expect(await notifCount()).toBe(before + 1);
    const second = await ctx.http().post(`/v1/crm/presentations/public/${created.body.token}/open`);
    expect(second.body).toMatchObject({ openCount: 2, first: false });
    expect(await notifCount()).toBe(before + 1);

    const list = await agent.get('/v1/crm/presentations');
    const row = list.body.find((p: { id: string }) => p.id === created.body.id);
    expect(row.openCount).toBe(2);
    expect(row.openedAt).toBeTruthy();

    const pdf = await agent.get(`/v1/crm/presentations/${created.body.id}/pdf`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    const publicPdf = await ctx.http().get(`/v1/crm/presentations/public/${created.body.token}/pdf`);
    expect(publicPdf.status).toBe(200);

    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    const otherList = await other.get('/v1/crm/presentations');
    expect(otherList.body.some((p: { id: string }) => p.id === created.body.id)).toBe(false);
    expect((await other.get(`/v1/crm/presentations/${created.body.id}`)).status).toBe(404);
    expect((await other.get(`/v1/crm/presentations/${created.body.id}/pdf`)).status).toBe(404);
    expect((await other.get(`/v1/crm/presentations/${created.body.id}`).set('x-org-id', agent.orgId)).status).toBe(403);
  });

  it('serves the seeded demo-presentation token and rejects unknown tokens', async () => {
    const res = await ctx.http().get('/v1/crm/presentations/public/demo-presentation');
    expect(res.status).toBe(200);
    expect(res.body.listings.length).toBeGreaterThan(0);
    expect((await ctx.http().get('/v1/crm/presentations/public/unknown-token-xyz')).status).toBe(404);
  });

  it('validates input', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    expect((await agent.post('/v1/crm/presentations').send({ title: 'x', listingIds: [] })).status).toBe(422);
  });
});
