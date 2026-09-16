import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, organizations, eq, withOrg, sql } from '@lokacia/db';
import { createApp, loginAs, PHONES } from './helpers';

describe('organizations & tenant isolation', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('user creates an agency and invites an agent by phone', async () => {
    const owner = await loginAs(ctx.app, '+995599300300');
    const org = await owner.post('/v1/orgs').send({ name: 'ტესტ აგენტურა', type: 'agency' });
    expect(org.status).toBe(201);
    const invite = await owner.post('/v1/orgs/current/invites').set('x-org-id', org.body.id).send({ phone: '599 300 301', role: 'agent' });
    expect(invite.status).toBe(201);
    const agent = await loginAs(ctx.app, '+995599300301');
    expect(agent.user.orgs.map((o) => o.id)).toContain(org.body.id);
    const members = await agent.get('/v1/orgs/current/members').set('x-org-id', org.body.id);
    expect(members.body).toHaveLength(2);
    // agent cannot invite (manager only)
    const denied = await agent.post('/v1/orgs/current/invites').set('x-org-id', org.body.id).send({ phone: '599300302' });
    expect(denied.status).toBe(403);
  });

  it('guard denies access to another org', async () => {
    const manager2 = await loginAs(ctx.app, PHONES.agency2Manager);
    const [cityspaces] = await ctx.db.select().from(organizations).where(eq(organizations.slug, 'city-spaces'));
    const res = await manager2.get('/v1/orgs/current/members').set('x-org-id', cityspaces!.id);
    expect(res.status).toBe(403);
  });

  it('RLS hides other orgs rows even with a direct query', async () => {
    const [a] = await ctx.db.select().from(organizations).where(eq(organizations.slug, 'city-spaces'));
    const [b] = await ctx.db.select().from(organizations).where(eq(organizations.slug, 'business-lokacia'));
    const noCtx = await ctx.db.select().from(crmContacts);
    expect(noCtx).toHaveLength(0);
    const inA = await withOrg(ctx.db, a!.id, (tx) => tx.select().from(crmContacts));
    expect(inA.length).toBeGreaterThan(0);
    expect(inA.every((c) => c.orgId === a!.id)).toBe(true);
    const crossRead = await withOrg(ctx.db, b!.id, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, a!.id)));
    expect(crossRead).toHaveLength(0);
    const err = await withOrg(ctx.db, b!.id, (tx) => tx.insert(crmContacts).values({ orgId: a!.id, name: 'hack' })).catch((e: Error & { cause?: Error }) => e);
    expect(String((err as Error & { cause?: Error }).cause?.message ?? err)).toMatch(/row-level security/);
    await expect(withOrg(ctx.db, b!.id, (tx) => tx.execute(sql`update crm_contacts set name = 'x' where org_id = ${a!.id}`))).resolves.toBeDefined();
    const still = await withOrg(ctx.db, a!.id, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.name, 'x')));
    expect(still).toHaveLength(0);
  });
});
