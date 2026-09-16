'use client';
import type { Problem } from '@lokacia/contracts';
import { readOrgCookie } from './org';

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

type Init = { method?: string; body?: unknown; orgId?: string | null; headers?: Record<string, string>; raw?: boolean; noOrg?: boolean };

/**
 * Browser API call through the same-origin `/api/v1` rewrite. Every call carries `x-org-id` of the selected
 * organization (cookie `lk_org`) unless `noOrg` is set. Retries once after refreshing the session on 401.
 */
export async function apiFetch<T>(path: string, init: Init = {}): Promise<T> {
  const url = path.startsWith('/api/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const orgId = init.noOrg ? null : (init.orgId ?? readOrgCookie());
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const doFetch = () =>
    fetch(url, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(init.body !== undefined && !isForm ? { 'content-type': 'application/json' } : {}),
        ...(orgId ? { 'x-org-id': orgId } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    });
  let res = await doFetch();
  if (res.status === 401 && !path.includes('/auth/')) {
    if (await refresh()) res = await doFetch();
    else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as Problem | null;
    throw new ClientApiError(res.status, problem);
  }
  if (init.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const fetcher = <T,>(path: string) => apiFetch<T>(path);

/** Downloads a file from the API (exports, PDFs) keeping auth + org headers. */
export async function downloadFile(path: string, fileName: string) {
  const res = await apiFetch<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Uploads a file via the presigned media flow; resolves with the media id. */
export async function uploadFile(file: File | Blob, opts: { kind: 'photo' | 'video' | 'plan' | 'pano360' | 'document'; fileName?: string; listingId?: string | null; onProgress?: (pct: number) => void }) {
  const name = opts.fileName ?? (file instanceof File ? file.name : 'file');
  const created = await apiFetch<{ id: string; uploadUrl: string; headers: Record<string, string>; url?: string }>('/media/uploads', {
    method: 'POST',
    body: { kind: opts.kind, contentType: file.type || 'application/octet-stream', fileName: name, listingId: opts.listingId ?? null, size: file.size },
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

export function errorMessage(e: unknown): string {
  if (e instanceof ClientApiError) return e.problem?.errors?.[0]?.message ? `${e.problem.title}: ${e.problem.errors[0].message}` : e.message;
  return e instanceof Error ? e.message : 'შეცდომა';
}
