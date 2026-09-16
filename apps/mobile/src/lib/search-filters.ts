import { PASSPORT_KEYS, filtersToParams, type SearchFilters } from '@lokacia/contracts';
import { createStore } from './store';

/** Shared by Search, Map and Filters screens. Money is whole GEL (same URL format as the web). */
export const searchFilters = createStore<SearchFilters>({});

/** Number of active filters shown on the "ფილტრები · N" button (business type chip and text query excluded). */
export function activeFilterCount(f: SearchFilters): number {
  const skip = new Set(['q', 'businessType', 'sort', 'bbox', 'lat', 'lng', 'radiusM', 'city']);
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (skip.has(k) || v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    n++;
  }
  return n;
}

/** Query params for GET /v1/listings (and /listings/map) using the shared contracts serializer. */
export function searchQuery(f: SearchFilters, extra: { cursor?: string | null; limit?: number } = {}): URLSearchParams {
  const p = filtersToParams(f);
  if (extra.cursor) p.set('cursor', extra.cursor);
  if (extra.limit) p.set('limit', String(extra.limit));
  return p;
}

/** Merge NL-parsed filters (POST /v1/search/parse) into the current ones; parsed keys win, passport keys are reset. */
export function mergeParsed(current: SearchFilters, parsed: Partial<SearchFilters>): SearchFilters {
  const base: Record<string, unknown> = { ...current };
  for (const k of PASSPORT_KEYS) delete base[k];
  delete base.q;
  return { ...(base as SearchFilters), ...parsed };
}

/** Parse a whole-number text field; empty → undefined. */
export function numberOrUndefined(text: string): number | undefined {
  const s = text.replace(/\s/g, '').replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
