import { MOBILE_CLIENT_HEADER, MOBILE_CLIENT_VALUE, type MobileRefreshResponse, type MobileVerifyResponse, type Problem, type SessionUser } from '@lokacia/contracts';
import { apiUrl, resolveApiAssetUrl } from './urls';

/**
 * Framework-free API client for the mobile app (V7).
 * - Sends `x-client: mobile` so auth endpoints return tokens in the body (no cookies).
 * - Access token in `Authorization: Bearer`; refreshed proactively before expiry and once after a 401.
 * - Refresh is single-flight: concurrent requests share one rotation (the API revokes the family on reuse).
 */

export type StoredTokens = { accessToken: string; refreshToken: string; /** epoch ms */ accessExpiresAt: number };

export interface TokenStore {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens | null): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem | null,
    message?: string,
  ) {
    super(message ?? problem?.detail ?? problem?.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null> | URLSearchParams;
  /** CRM/org-scoped endpoints (`x-org-id`). */
  orgId?: string | null;
  /** `false` = never attach/refresh tokens (public auth endpoints). */
  auth?: boolean;
  signal?: AbortSignal;
};

export type UploadInput = {
  uri: string;
  name: string;
  type: string;
  kind: 'photo' | 'video' | 'plan' | 'pano360' | 'document';
  listingId?: string | null;
  size?: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  baseUrl: string;
  store: TokenStore;
  fetch?: FetchLike;
  now?: () => number;
  /** refresh this many ms before the access token expires */
  refreshSkewMs?: number;
  onSessionExpired?: () => void;
};

export function createApiClient(opts: ApiClientOptions) {
  const doFetch: FetchLike = opts.fetch ?? ((i, init) => fetch(i, init));
  const now = opts.now ?? (() => Date.now());
  const skew = opts.refreshSkewMs ?? 30_000;
  let cached: StoredTokens | null | undefined;
  let refreshing: Promise<StoredTokens | null> | null = null;

  async function tokens(): Promise<StoredTokens | null> {
    if (cached === undefined) cached = await opts.store.load();
    return cached;
  }

  async function setTokens(t: StoredTokens | null) {
    cached = t;
    await opts.store.save(t);
  }

  function toStored(r: { accessToken: string; refreshToken: string; expiresIn: number }): StoredTokens {
    return { accessToken: r.accessToken, refreshToken: r.refreshToken, accessExpiresAt: now() + r.expiresIn * 1000 };
  }

  async function parseError(res: Response): Promise<ApiError> {
    let problem: Problem | null = null;
    try {
      const text = await res.text();
      problem = text ? (JSON.parse(text) as Problem) : null;
    } catch {
      problem = null;
    }
    return new ApiError(res.status, problem);
  }

  function refresh(): Promise<StoredTokens | null> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const current = await tokens();
      if (!current) return null;
      const res = await doFetch(apiUrl(opts.baseUrl, '/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (res.status === 401 || res.status === 403) {
        await setTokens(null);
        opts.onSessionExpired?.();
        return null;
      }
      if (!res.ok) throw await parseError(res);
      const next = toStored((await res.json()) as MobileRefreshResponse);
      await setTokens(next);
      return next;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /** Valid access token (refreshing when close to expiry) or null when signed out. */
  async function accessToken(): Promise<string | null> {
    const t = await tokens();
    if (!t) return null;
    if (t.accessExpiresAt - skew > now()) return t.accessToken;
    return (await refresh())?.accessToken ?? null;
  }

  function buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = apiUrl(opts.baseUrl, path);
    if (!query) return url;
    const params = query instanceof URLSearchParams ? query : new URLSearchParams();
    if (!(query instanceof URLSearchParams)) {
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
    const useAuth = o.auth !== false;
    const send = async (token: string | null) => {
      const headers: Record<string, string> = { accept: 'application/json', [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE };
      if (o.body !== undefined) headers['content-type'] = 'application/json';
      if (token) headers.authorization = `Bearer ${token}`;
      if (o.orgId) headers['x-org-id'] = o.orgId;
      return doFetch(buildUrl(path, o.query), { method: o.method ?? 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body), signal: o.signal });
    };
    const token = useAuth ? await accessToken() : null;
    let res = await send(token);
    if (res.status === 401 && useAuth && token) {
      const renewed = await refresh();
      if (renewed) res = await send(renewed.accessToken);
    }
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    baseUrl: opts.baseUrl,
    request,
    accessToken,
    refresh,
    /** Asset URL from the API (e.g. `/api/v1/media/...`) → absolute. */
    asset: (url: string | null | undefined) => resolveApiAssetUrl(opts.baseUrl, url),
    async hasSession() {
      return !!(await tokens());
    },
    async requestOtp(phone: string) {
      return request<{ sent: boolean; expiresInSec: number; devCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone }, auth: false });
    },
    async verifyOtp(phone: string, code: string, name?: string): Promise<SessionUser> {
      const r = await request<MobileVerifyResponse>('/auth/otp/verify', { method: 'POST', body: { phone, code, ...(name ? { name } : {}) }, auth: false });
      if (!r.accessToken || !r.refreshToken) throw new ApiError(500, null, 'token mode not supported by the API');
      await setTokens(toStored(r));
      return r.user;
    },
    async logout() {
      const t = await tokens();
      await setTokens(null);
      if (t) {
        await doFetch(apiUrl(opts.baseUrl, '/auth/logout'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_VALUE },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        }).catch(() => undefined);
      }
    },
    /** POST /media/uploads → PUT bytes to the upload URL → complete (S3 driver only; local driver completes on PUT). */
    async upload(file: UploadInput): Promise<string> {
      const created = await request<{ id: string; uploadUrl: string; headers?: Record<string, string> }>('/media/uploads', {
        method: 'POST',
        body: { kind: file.kind, contentType: file.type, fileName: file.name, listingId: file.listingId ?? null, ...(file.size ? { size: file.size } : {}) },
      });
      const target = resolveApiAssetUrl(opts.baseUrl, created.uploadUrl)!;
      const blob = await (await doFetch(file.uri)).blob();
      const put = await doFetch(target, { method: 'PUT', headers: { 'content-type': file.type, ...(created.headers ?? {}) }, body: blob });
      if (!put.ok) throw await parseError(put);
      const isLocalDriver = created.uploadUrl.startsWith('/api/') || created.uploadUrl.startsWith('/v1/');
      if (!isLocalDriver) await request(`/media/${created.id}/complete`, { method: 'POST' });
      return created.id;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const first = e.problem?.errors?.[0]?.message;
    if (e.problem?.title && first) return `${e.problem.title}: ${first}`;
    return e.problem?.detail ?? e.problem?.title ?? fallback;
  }
  return fallback;
}
