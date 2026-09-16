/**
 * URL helpers. The API returns web-relative URLs (`/api/v1/media/...`, served through the Next rewrite) —
 * the app talks to the API directly, so those map to `<API>/v1/...`.
 */
export function trimBase(base: string): string {
  return base.replace(/\/+$/, '');
}

export function apiUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${trimBase(base)}${p.startsWith('/v1/') ? p : `/v1${p}`}`;
}

/** Media / upload URL from the API → absolute URL reachable from the device. */
export function resolveApiAssetUrl(base: string, url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|file:|blob:)/i.test(url)) return url;
  if (url.startsWith('/api/v1/')) return `${trimBase(base)}${url.slice(4)}`;
  if (url.startsWith('/v1/')) return `${trimBase(base)}${url}`;
  return `${trimBase(base)}${url.startsWith('/') ? url : `/${url}`}`;
}

/**
 * Notification / share link (web path, possibly absolute with APP_URL) → in-app route.
 * Unknown paths return null (caller opens nothing).
 */
export function linkToRoute(link: string | null | undefined): string | null {
  if (!link) return null;
  let path = link;
  const abs = /^https?:\/\/[^/]+(\/.*)?$/i.exec(link);
  if (abs) path = abs[1] ?? '/';
  const [pathname = '/', query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const seg = pathname.split('/').filter(Boolean);
  if (seg[0] === 'listings' && seg[1]) return `/listing/${encodeURIComponent(seg[1])}`;
  if (seg[0] === 'account') {
    if (seg[1] === 'messages') {
      const c = params.get('c') ?? (seg[2] === 'c' ? seg[3] : undefined);
      return c ? `/chat/${encodeURIComponent(c)}` : '/messages';
    }
    if (seg[1] === 'viewings') return '/viewings';
    if (seg[1] === 'offers') return '/offers';
    if (seg[1] === 'favorites') return '/favorites';
    return '/profile';
  }
  if (seg[0] === 'search' || seg[0] === 'map') return seg[0] === 'map' ? '/map' : '/';
  return null;
}
