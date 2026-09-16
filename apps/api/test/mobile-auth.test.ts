import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, users } from '@lokacia/db';
import { createApp, loginAs, PHONES } from './helpers';
import { CHANNELS, type MessageChannel } from '../src/integrations/channels/channels';
import type { MockPushChannel } from '../src/integrations/channels/push';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

const MOBILE = { 'x-client': 'mobile' };

describe('mobile token mode (V7)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  const verify = (phone: string) => ctx.http().post('/v1/auth/otp/verify').set(MOBILE).send({ phone, code: '123456' });

  it('returns tokens in the body and sets no cookies for x-client: mobile', async () => {
    const res = await verify(PHONES.tenant);
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONES.tenant);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.expiresIn).toBe(900);
    expect(res.headers['set-cookie']).toBeUndefined();

    const me = await ctx.http().get('/v1/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.phone).toBe(PHONES.tenant);
  });

  it('keeps the web cookie flow unchanged (no tokens in body)', async () => {
    const res = await ctx.http().post('/v1/auth/otp/verify').send({ phone: PHONES.tenant, code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('lk_rt='))).toBe(true);
    const r = await ctx.http().post('/v1/auth/refresh').set('Cookie', cookies.find((c) => c.startsWith('lk_rt='))!.split(';')[0]!);
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).toBeUndefined();
  });

  it('rotates the refresh token from the JSON body and revokes the family on reuse', async () => {
    const login = await verify(PHONES.owner);
    const rt1 = login.body.refreshToken as string;
    const r1 = await ctx.http().post('/v1/auth/refresh').set(MOBILE).send({ refreshToken: rt1 });
    expect(r1.status).toBe(200);
    expect(r1.body.ok).toBe(true);
    expect(r1.body.refreshToken).toBeTruthy();
    expect(r1.body.refreshToken).not.toBe(rt1);
    expect(r1.headers['set-cookie']).toBeUndefined();
    const me = await ctx.http().get('/v1/auth/me').set('Authorization', `Bearer ${r1.body.accessToken}`);
    expect(me.status).toBe(200);

    const reuse = await ctx.http().post('/v1/auth/refresh').set(MOBILE).send({ refreshToken: rt1 });
    expect(reuse.status).toBe(401);
    const after = await ctx.http().post('/v1/auth/refresh').set(MOBILE).send({ refreshToken: r1.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('rejects mobile refresh without a body token and ignores the body without the header', async () => {
    const missing = await ctx.http().post('/v1/auth/refresh').set(MOBILE).send({});
    expect(missing.status).toBe(401);
    const login = await verify(PHONES.developer);
    // without x-client: mobile the body is not a credential (cookie flow only)
    const web = await ctx.http().post('/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(web.status).toBe(401);
  });

  it('logs out a mobile session by body refresh token', async () => {
    const login = await verify(PHONES.provider);
    const out = await ctx.http().post('/v1/auth/logout').set(MOBILE).send({ refreshToken: login.body.refreshToken });
    expect(out.status).toBe(200);
    const r = await ctx.http().post('/v1/auth/refresh').set(MOBILE).send({ refreshToken: login.body.refreshToken });
    expect(r.status).toBe(401);
  });

  it('registers Expo push tokens, keeps them across settings saves and mirrors in-app notifications to push', async () => {
    const login = await verify(PHONES.tenant);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const token = 'ExponentPushToken[test-device-000001]';

    const bad = await ctx.http().post('/v1/users/me/push-token').set(auth).send({ token: 'nope' });
    expect(bad.status).toBe(422);
    const anon = await ctx.http().post('/v1/users/me/push-token').send({ token });
    expect(anon.status).toBe(401);

    const ok = await ctx.http().post('/v1/users/me/push-token').set(auth).send({ token, platform: 'ios' });
    expect(ok.status).toBe(200);
    const again = await ctx.http().post('/v1/users/me/push-token').set(auth).send({ token });
    expect(again.body.devices).toBe(1);

    // web notification settings form sends only categories — tokens must survive
    const patch = await ctx.http().patch('/v1/users/me').set(auth).send({ notificationPrefs: { offers: ['in_app'] } });
    expect(patch.status).toBe(200);
    const row = await ctx.db.query.users.findFirst({ where: eq(users.id, login.body.user.id) });
    expect(row!.notificationPrefs.pushTokens).toEqual([token]);
    expect(row!.notificationPrefs.offers).toEqual(['in_app']);

    const push = ctx.app.get<Record<string, MessageChannel>>(CHANNELS).push as MockPushChannel;
    const before = push.outbox.length;
    await ctx.app.get(NotificationsService).notify({ userId: login.body.user.id, template: 'generic', vars: { title: 'ტესტი', body: 'შეტყობინება' }, channels: ['in_app'] });
    await ctx.queue.drain();
    const sent = push.outbox.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tokens).toEqual([token]);

    const del = await ctx.http().delete('/v1/users/me/push-token').set(auth).send({ token });
    expect(del.status).toBe(200);
    expect(del.body.devices).toBe(0);
  });

  it('still works with the cookie agent for the web', async () => {
    const agent = await loginAs(ctx.app, PHONES.tenant);
    const me = await agent.get('/v1/auth/me');
    expect(me.status).toBe(200);
  });
});
