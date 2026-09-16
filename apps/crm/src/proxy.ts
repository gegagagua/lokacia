import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Next 16 proxy: (1) silent session refresh when the 15-minute access cookie expired but the refresh cookie exists,
 * (2) exposes the requested path to server layouts (`x-lk-path`) so login redirects can come back.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  const baseHeaders = new Headers(req.headers);
  baseHeaders.set('x-lk-path', path);
  const hasAccess = req.cookies.has('lk_at');
  const refresh = req.cookies.get('lk_rt')?.value;
  if (hasAccess || !refresh) return NextResponse.next({ request: { headers: baseHeaders } });
  try {
    const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { cookie: `lk_rt=${refresh}`, 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' } });
    const setCookies = r.headers.getSetCookie();
    if (!r.ok) {
      const res = NextResponse.next({ request: { headers: baseHeaders } });
      res.cookies.delete('lk_rt');
      return res;
    }
    const reqCookies = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const [name, ...v] = pair!.split('=');
      reqCookies.set(name!.trim(), v.join('='));
    }
    baseHeaders.set('cookie', [...reqCookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const forwarded = NextResponse.next({ request: { headers: baseHeaders } });
    for (const sc of setCookies) forwarded.headers.append('set-cookie', sc);
    return forwarded;
  } catch {
    return NextResponse.next({ request: { headers: baseHeaders } });
  }
}

export const config = { matcher: ['/((?!api/|_next/|favicon|icon|sw.js|robots.txt|manifest|offline|.*\\.(?:svg|png|jpg|webp|ico|txt|xml|js)$).*)'] };
