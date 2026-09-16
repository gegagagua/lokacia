import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Silent session refresh (Next 16 proxy) + exposes the requested path to server layouts (`x-pathname`)
 * so the auth guard can redirect back after login.
 */
export async function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  const hasAccess = req.cookies.has('lk_at');
  const refresh = req.cookies.get('lk_rt')?.value;
  if (hasAccess || !refresh) return NextResponse.next({ request: { headers } });
  try {
    const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { cookie: `lk_rt=${refresh}`, 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' } });
    const setCookies = r.headers.getSetCookie();
    if (!r.ok) {
      const res = NextResponse.next({ request: { headers } });
      res.cookies.delete('lk_rt');
      return res;
    }
    const reqCookies = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const [name, ...v] = pair!.split('=');
      reqCookies.set(name!.trim(), v.join('='));
    }
    headers.set('cookie', [...reqCookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const forwarded = NextResponse.next({ request: { headers } });
    for (const sc of setCookies) forwarded.headers.append('set-cookie', sc);
    return forwarded;
  } catch {
    return NextResponse.next({ request: { headers } });
  }
}

export const config = { matcher: ['/((?!api/|_next/|favicon|icon|robots.txt|.*\\.(?:svg|png|jpg|webp|ico|txt|xml)$).*)'] };
