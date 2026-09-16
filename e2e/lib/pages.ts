import { request, test, type Page } from '@playwright/test';
import { API_URL, WEB_URL } from './env';

const cache = new Map<string, number>();

/** HTTP status of a route (GET, no redirects), cached per worker. */
export async function routeStatus(url: string): Promise<number> {
  if (cache.has(url)) return cache.get(url)!;
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(url, { maxRedirects: 0, failOnStatusCode: false, timeout: 60_000 });
    cache.set(url, res.status());
    return res.status();
  } catch {
    cache.set(url, 0);
    return 0;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Mark the running test `fixme` when a page is not built yet (404 / unreachable) — the same specs
 * turn on automatically once the owning stream ships the route.
 */
export async function requirePage(path: string, owner = 'portal stream', base = WEB_URL) {
  const status = await routeStatus(new URL(path, base).toString());
  test.fixme(status === 404 || status === 0, `awaiting ${owner}: ${base}${path} → ${status || 'unreachable'} (not built yet — lead re-runs later)`);
  return status;
}

export type ApiListing = { id: string; slug: string; title: string; businessTypes: string[] };

export async function firstListing(): Promise<ApiListing | null> {
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(`${API_URL}/v1/listings?limit=1`, { failOnStatusCode: false });
    if (!res.ok()) return null;
    const body = (await res.json()) as { items?: ApiListing[] };
    return body.items?.[0] ?? null;
  } finally {
    await ctx.dispose();
  }
}

/** Listing page URL: env override or the first candidate route that responds 200. */
export async function listingPath(): Promise<string | null> {
  const l = await firstListing();
  if (!l) return null;
  const candidates = process.env.E2E_LISTING_PATH ? [process.env.E2E_LISTING_PATH.replace(':slug', l.slug).replace(':id', l.id)] : [`/listings/${l.slug}`, `/listings/${l.id}`, `/l/${l.slug}`, `/listing/${l.slug}`];
  for (const c of candidates) {
    const s = await routeStatus(new URL(c, WEB_URL).toString());
    if (s >= 200 && s < 400) return c;
  }
  return null;
}

/** Collect console errors and uncaught page errors. */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Public pages audited for a11y / SEO / mobile layout. */
export const PUBLIC_PAGES = ['/', '/search', '/map', '/demand', '/services', '/projects', '/pricing', '/login'] as const;

/** Wait for the page to settle. Dev servers keep HMR sockets and map tiles streaming, so `networkidle` is best-effort. */
export async function settle(page: Page, idleMs = 5_000) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: idleMs }).catch(() => undefined);
}
