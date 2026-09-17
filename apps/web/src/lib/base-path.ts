/**
 * Sub-path hosting (e.g. https://digitalfix.cloud/lokacia). Set NEXT_BASE_PATH at build time; next.config.ts mirrors it into
 * NEXT_PUBLIC_BASE_PATH. `next/link` and the router prefix automatically — everything else (fetch, <a>, <img>, window.location)
 * goes through `withBase`. Empty at a domain root, where every helper is a no-op.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

/** Prefixes a root-relative URL with the base path (idempotent; absolute, protocol-relative and hash URLs are returned as-is). */
export function withBase(url: string): string {
  if (!BASE_PATH || !url.startsWith('/') || url.startsWith('//')) return url;
  if (url === BASE_PATH || url.startsWith(`${BASE_PATH}/`) || url.startsWith(`${BASE_PATH}?`)) return url;
  return `${BASE_PATH}${url}`;
}

/** Removes the base path from a browser pathname (`/lokacia/en/search` → `/en/search`). */
export function stripBase(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return '/';
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
}
