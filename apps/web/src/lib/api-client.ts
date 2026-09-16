'use client';
import type { Problem } from '@lokacia/contracts';

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public problem: Problem | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `შეცდომა ${status}`);
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh() {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

/** Browser API call through the same-origin `/api/v1` rewrite. Retries once after refreshing the session on 401. */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; orgId?: string | null; headers?: Record<string, string>; raw?: boolean } = {}): Promise<T> {
  const url = path.startsWith('/api/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const doFetch = () =>
    fetch(url, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(init.body !== undefined && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(init.orgId ? { 'x-org-id': init.orgId } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
    });
  let res = await doFetch();
  if (res.status === 401 && !path.includes('/auth/')) {
    if (await refresh()) res = await doFetch();
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as Problem | null;
    throw new ClientApiError(res.status, problem);
  }
  if (init.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  // Nest sends an empty body for `null` results
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const fetcher = <T,>(path: string) => apiFetch<T>(path);

/** Uploads a file via the presigned flow and resolves when processing is queued. */
export async function uploadFile(file: File, opts: { kind: 'photo' | 'video' | 'plan' | 'pano360' | 'document'; listingId?: string | null; onProgress?: (pct: number) => void }) {
  const created = await apiFetch<{ id: string; uploadUrl: string; headers: Record<string, string> }>('/media/uploads', {
    method: 'POST',
    body: { kind: opts.kind, contentType: file.type || 'application/octet-stream', fileName: file.name, listingId: opts.listingId ?? null, size: file.size },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', created.uploadUrl);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.send(file);
  });
  if (!created.uploadUrl.startsWith('/api/')) await apiFetch(`/media/${created.id}/complete`, { method: 'POST' });
  return created.id;
}
