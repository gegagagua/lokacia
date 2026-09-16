import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, errorMessage, type StoredTokens, type TokenStore } from './api-client';

type Call = { url: string; init?: RequestInit };

function memoryStore(initial: StoredTokens | null = null): TokenStore & { value: StoredTokens | null; saves: number } {
  const s = {
    value: initial,
    saves: 0,
    async load() {
      return s.value;
    },
    async save(t: StoredTokens | null) {
      s.value = t;
      s.saves++;
    },
  };
  return s;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const headers = (c: Call) => (c.init?.headers ?? {}) as Record<string, string>;

function setup(opts: { tokens?: StoredTokens | null; handler: (url: string, init: RequestInit | undefined, calls: Call[]) => Response | Promise<Response>; now?: number }) {
  const calls: Call[] = [];
  const store = memoryStore(opts.tokens ?? null);
  let now = opts.now ?? 1_000_000;
  const onSessionExpired = vi.fn();
  const client = createApiClient({
    baseUrl: 'http://api.test/',
    store,
    now: () => now,
    onSessionExpired,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return opts.handler(url, init, calls);
    },
  });
  return { client, calls, store, onSessionExpired, advance: (ms: number) => (now += ms) };
}

describe('api client (mobile token mode)', () => {
  it('sends x-client: mobile and the bearer token, maps paths under /v1', async () => {
    const { client, calls } = setup({
      tokens: { accessToken: 'A1', refreshToken: 'R1', accessExpiresAt: 1_000_000 + 600_000 },
      handler: () => json(200, { ok: 1 }),
    });
    await client.request('/favorites', { query: { limit: 5, empty: '', none: undefined } });
    expect(calls[0]!.url).toBe('http://api.test/v1/favorites?limit=5');
    expect(headers(calls[0]!)['x-client']).toBe('mobile');
    expect(headers(calls[0]!).authorization).toBe('Bearer A1');
  });

  it('verifyOtp stores tokens from the body with an absolute expiry', async () => {
    const { client, store, calls } = setup({
      handler: () => json(200, { user: { id: 'u1', phone: '+995500000006' }, expiresIn: 900, accessToken: 'A', refreshToken: 'R' }),
    });
    const user = await client.verifyOtp('+995500000006', '123456');
    expect(user.id).toBe('u1');
    expect(store.value).toEqual({ accessToken: 'A', refreshToken: 'R', accessExpiresAt: 1_000_000 + 900_000 });
    expect(headers(calls[0]!).authorization).toBeUndefined();
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ phone: '+995500000006', code: '123456' });
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    const { client, calls, store } = setup({
      tokens: { accessToken: 'OLD', refreshToken: 'R1', accessExpiresAt: 1_000_000 + 10_000 },
      handler: (url) => (url.endsWith('/v1/auth/refresh') ? json(200, { ok: true, expiresIn: 900, accessToken: 'NEW', refreshToken: 'R2' }) : json(200, [])),
    });
    await client.request('/conversations');
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/v1/auth/refresh', 'http://api.test/v1/conversations']);
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ refreshToken: 'R1' });
    expect(headers(calls[0]!)['x-client']).toBe('mobile');
    expect(headers(calls[1]!).authorization).toBe('Bearer NEW');
    expect(store.value?.refreshToken).toBe('R2');
  });

  it('retries once after a 401 with a rotated token', async () => {
    const { client, calls } = setup({
      tokens: { accessToken: 'REVOKED', refreshToken: 'R1', accessExpiresAt: 1_000_000 + 600_000 },
      handler: (url, init) => {
        if (url.endsWith('/auth/refresh')) return json(200, { ok: true, expiresIn: 900, accessToken: 'A2', refreshToken: 'R2' });
        return (init?.headers as Record<string, string>).authorization === 'Bearer A2' ? json(200, { id: 'me' }) : json(401, { title: 'unauthorized', status: 401, type: 'x' });
      },
    });
    await expect(client.request<{ id: string }>('/auth/me')).resolves.toEqual({ id: 'me' });
    expect(calls).toHaveLength(3);
  });

  it('shares one refresh between concurrent requests (single-flight rotation)', async () => {
    let refreshes = 0;
    const { client } = setup({
      tokens: { accessToken: 'OLD', refreshToken: 'R1', accessExpiresAt: 0 },
      handler: async (url) => {
        if (url.endsWith('/auth/refresh')) {
          refreshes++;
          await new Promise((r) => setTimeout(r, 5));
          return json(200, { ok: true, expiresIn: 900, accessToken: 'A2', refreshToken: 'R2' });
        }
        return json(200, {});
      },
    });
    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    expect(refreshes).toBe(1);
  });

  it('clears the session and notifies when the refresh token is rejected', async () => {
    const { client, store, onSessionExpired } = setup({
      tokens: { accessToken: 'OLD', refreshToken: 'REUSED', accessExpiresAt: 0 },
      handler: (url) => (url.endsWith('/auth/refresh') ? json(401, { title: 'unauthorized', status: 401, type: 'x' }) : json(401, { title: 'unauthorized', status: 401, type: 'x' })),
    });
    await expect(client.request('/favorites')).rejects.toBeInstanceOf(ApiError);
    expect(store.value).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(await client.hasSession()).toBe(false);
  });

  it('does not attach tokens to public auth calls and surfaces problem+json', async () => {
    const { client, calls } = setup({
      tokens: { accessToken: 'A', refreshToken: 'R', accessExpiresAt: 0 },
      handler: () => json(401, { type: 'otp-invalid', title: 'კოდი არასწორია ან ვადა გაუვიდა', status: 401 }),
    });
    const err = await client.verifyOtp('+995500000006', '000000').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(errorMessage(err, 'fallback')).toBe('კოდი არასწორია ან ვადა გაუვიდა');
    expect(calls).toHaveLength(1);
    expect(headers(calls[0]!).authorization).toBeUndefined();
  });

  it('logout clears tokens and revokes the refresh token server-side', async () => {
    const { client, store, calls } = setup({ tokens: { accessToken: 'A', refreshToken: 'R9', accessExpiresAt: 9e15 }, handler: () => json(200, { ok: true }) });
    await client.logout();
    expect(store.value).toBeNull();
    expect(calls[0]!.url).toBe('http://api.test/v1/auth/logout');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ refreshToken: 'R9' });
  });

  it('uploads via the relative local-storage URL mapped to the API base (no complete call)', async () => {
    const { client, calls } = setup({
      tokens: { accessToken: 'A', refreshToken: 'R', accessExpiresAt: 9e15 },
      handler: (url) => {
        if (url.endsWith('/v1/media/uploads')) return json(200, { id: 'm1', uploadUrl: '/api/v1/media/uploads/uploads%2Fx%2Foriginal.jpg?token=abc', headers: { 'content-type': 'image/jpeg' } });
        if (url.startsWith('file://')) return new Response('bytes');
        return json(200, { id: 'm1' });
      },
    });
    const id = await client.upload({ uri: 'file:///tmp/p.jpg', name: 'p.jpg', type: 'image/jpeg', kind: 'photo', listingId: 'l1' });
    expect(id).toBe('m1');
    expect(calls.map((c) => [c.init?.method ?? 'GET', c.url])).toEqual([
      ['POST', 'http://api.test/v1/media/uploads'],
      ['GET', 'file:///tmp/p.jpg'],
      ['PUT', 'http://api.test/v1/media/uploads/uploads%2Fx%2Foriginal.jpg?token=abc'],
    ]);
  });

  it('calls /complete for presigned (S3) uploads', async () => {
    const { client, calls } = setup({
      tokens: { accessToken: 'A', refreshToken: 'R', accessExpiresAt: 9e15 },
      handler: (url) => (url.endsWith('/v1/media/uploads') ? json(200, { id: 'm2', uploadUrl: 'https://r2.example/bucket/key?sig=1' }) : url.startsWith('file:') ? new Response('x') : json(200, {})),
    });
    await client.upload({ uri: 'file:///a.m4a', name: 'a.m4a', type: 'audio/mp4', kind: 'document' });
    expect(calls.at(-1)!.url).toBe('http://api.test/v1/media/m2/complete');
  });
});
