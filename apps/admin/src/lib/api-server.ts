import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Problem } from '@lokacia/contracts';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: Problem | null,
  ) {
    super(problem?.title ?? `API ${status}`);
  }
}

type Opts = { method?: string; body?: unknown; revalidate?: number | false; tags?: string[]; orgId?: string; auth?: boolean };

/**
 * Server-side API call. Forwards the user's cookies (when `auth` is not false) so SSR pages render
 * personalized data. Public cacheable calls should pass `auth: false` + `revalidate`.
 */
export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (opts.auth !== false) {
    const c = await cookies();
    const cookie = c.toString();
    if (cookie) h.cookie = cookie;
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
    if (ip) h['x-forwarded-for'] = ip;
  }
  if (opts.orgId) h['x-org-id'] = opts.orgId;
  if (opts.body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${API_URL}${path.startsWith('/v1') ? path : `/v1${path}`}`, {
    method: opts.method ?? 'GET',
    headers: h,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    ...(opts.auth === false && opts.revalidate !== undefined ? { next: { revalidate: opts.revalidate, tags: opts.tags } } : { cache: 'no-store' as const }),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as Problem | null;
    throw new ApiError(res.status, problem);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Same as `api` but returns null on 401/403/404 (handy for optional data in pages). */
export async function apiOrNull<T>(path: string, opts: Opts = {}): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiError && [401, 403, 404].includes(e.status)) return null;
    throw e;
  }
}
