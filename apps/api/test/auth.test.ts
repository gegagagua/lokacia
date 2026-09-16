import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, loginAs, PHONES } from './helpers';

describe('auth', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('signs up a new user by phone OTP', async () => {
    const r1 = await ctx.http().post('/v1/auth/otp/request').send({ phone: '599 12 34 56' });
    expect(r1.status).toBe(200);
    const agent = await loginAs(ctx.app, '+995599123456');
    expect(agent.user.id).toBeTruthy();
    const me = await agent.get('/v1/auth/me');
    expect(me.body.phone).toBe('+995599123456');
  });

  it('rejects a wrong code with problem+json', async () => {
    const res = await ctx.http().post('/v1/auth/otp/verify').send({ phone: '+995599000111', code: '000001' });
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.type).toContain('otp-invalid');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const login = await ctx.http().post('/v1/auth/otp/verify').send({ phone: PHONES.tenant, code: '123456' });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const rt = cookies.find((c) => c.startsWith('lk_rt='))!.split(';')[0]!;
    const r1 = await ctx.http().post('/v1/auth/refresh').set('Cookie', rt);
    expect(r1.status).toBe(200);
    const rt2 = (r1.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('lk_rt='))!.split(';')[0]!;
    // reuse the old one → 401 and the new one is revoked too
    const reuse = await ctx.http().post('/v1/auth/refresh').set('Cookie', rt);
    expect(reuse.status).toBe(401);
    const afterReuse = await ctx.http().post('/v1/auth/refresh').set('Cookie', rt2);
    expect(afterReuse.status).toBe(401);
  });

  it('requires auth by default', async () => {
    expect((await ctx.http().get('/v1/auth/me')).status).toBe(401);
    expect((await ctx.http().get('/v1/health')).status).toBe(200);
  });

  it('rate-limits OTP requests per phone', async () => {
    let last = 200;
    for (let i = 0; i < 7; i++) last = (await request(ctx.app.getHttpServer()).post('/v1/auth/otp/request').send({ phone: '+995599777888' })).status;
    expect(last).toBe(429);
  });
});
