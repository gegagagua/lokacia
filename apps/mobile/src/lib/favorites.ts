import { useEffect, useSyncExternalStore } from 'react';
import { endpoints } from './api';
import { createStore } from './store';

/** Favorite listing ids for heart toggles across screens (optimistic). */
export const favoriteIds = createStore<ReadonlySet<string>>(new Set());

export async function loadFavoriteIds() {
  try {
    favoriteIds.set(new Set(await endpoints.favoriteIds()));
  } catch {
    /* signed out or offline */
  }
}

export async function toggleFavorite(listingId: string) {
  const had = favoriteIds.get().has(listingId);
  const next = new Set(favoriteIds.get());
  if (had) next.delete(listingId);
  else next.add(listingId);
  favoriteIds.set(next);
  try {
    if (had) await endpoints.removeFavorite(listingId);
    else await endpoints.addFavorite(listingId);
  } catch (e) {
    const revert = new Set(favoriteIds.get());
    if (had) revert.add(listingId);
    else revert.delete(listingId);
    favoriteIds.set(revert);
    throw e;
  }
}

export function useFavoriteIds(enabled: boolean): ReadonlySet<string> {
  useEffect(() => {
    if (enabled) void loadFavoriteIds();
    else favoriteIds.set(new Set());
  }, [enabled]);
  return useSyncExternalStore(favoriteIds.subscribe, favoriteIds.get, favoriteIds.get);
}
