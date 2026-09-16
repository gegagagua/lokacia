'use client';
import useSWRInfinite from 'swr/infinite';
import { fetcher } from './api-client';

type Page<T> = { items: T[]; nextCursor: string | null; total?: number };

/** Cursor pagination over `{ items, nextCursor }` endpoints. `url` must not contain `cursor`. */
export function useCursorList<T>(url: string | null) {
  const res = useSWRInfinite<Page<T>>(
    (i, prev) => {
      if (!url) return null;
      if (i === 0) return url;
      if (!prev?.nextCursor) return null;
      return `${url}${url.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(prev.nextCursor)}`;
    },
    fetcher,
    { revalidateFirstPage: true },
  );
  const items = res.data?.flatMap((p) => p.items) ?? [];
  const last = res.data?.at(-1);
  return {
    items,
    total: res.data?.[0]?.total,
    hasMore: !!last?.nextCursor,
    loadMore: () => res.setSize(res.size + 1),
    loading: !res.data && !res.error,
    loadingMore: res.isValidating && res.size > (res.data?.length ?? 0),
    error: res.error as unknown,
    mutate: res.mutate,
  };
}

export function qs(params: Record<string, string | number | undefined | null | false>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}
