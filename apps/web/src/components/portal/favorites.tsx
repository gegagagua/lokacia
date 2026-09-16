'use client';
import * as React from 'react';
import useSWR from 'swr';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

type Ctx = { ids: Set<string>; loggedIn: boolean | null; toggle: (listingId: string) => Promise<void>; isFavorite: (id: string) => boolean };
const FavoritesCtx = React.createContext<Ctx | null>(null);

/** Favorite ids for the current user (P14). Optimistic toggle; guests are sent to login. */
export function FavoritesProvider({ children, loggedIn }: { children: React.ReactNode; loggedIn?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { data, mutate, error } = useSWR<string[]>(loggedIn === false ? null : '/favorites/ids', (p: string) => apiFetch<string[]>(p), {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const authed = loggedIn ?? (error instanceof ClientApiError && error.status === 401 ? false : data ? true : null);
  const ids = React.useMemo(() => new Set(data ?? []), [data]);

  const toggle = React.useCallback(
    async (listingId: string) => {
      if (authed === false) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const was = ids.has(listingId);
      const next = was ? [...ids].filter((x) => x !== listingId) : [...ids, listingId];
      try {
        await mutate(
          async () => {
            if (was) await apiFetch(`/favorites/${listingId}`, { method: 'DELETE' });
            else await apiFetch('/favorites', { method: 'POST', body: { listingId } });
            return next;
          },
          { optimisticData: next, rollbackOnError: true, revalidate: false },
        );
      } catch (e) {
        if (e instanceof ClientApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(pathname)}`);
        else toast({ title: 'ფავორიტი ვერ შენახდა', description: 'სცადეთ ხელახლა.', tone: 'danger' });
      }
    },
    [authed, ids, mutate, pathname, router, toast],
  );

  const value = React.useMemo<Ctx>(() => ({ ids, loggedIn: authed, toggle, isFavorite: (id) => ids.has(id) }), [ids, authed, toggle]);
  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}

export function useFavorites(): Ctx {
  const c = React.useContext(FavoritesCtx);
  return c ?? { ids: new Set(), loggedIn: null, toggle: async () => undefined, isFavorite: () => false };
}
