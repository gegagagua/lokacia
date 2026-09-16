import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Silent session refresh (Next 16 proxy): when the 15-minute access cookie expired but the refresh cookie
 * exists, rotate tokens before rendering so server components see the user.
 */
export async function proxy(req: NextRequest) {
  const hasAccess = req.cookies.has('lk_at');
  const refresh = req.cookies.get('lk_rt')?.value;
  if (hasAccess || !refresh) return NextResponse.next();
  try {
    const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { cookie: `lk_rt=${refresh}`, 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' } });
    const setCookies = r.headers.getSetCookie();
    const res = NextResponse.next();
    if (!r.ok) {
      res.cookies.delete('lk_rt');
      return res;
    }
    // make new cookies visible to this request and persist them in the browser
    const reqCookies = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const [name, ...v] = pair!.split('=');
      reqCookies.set(name!.trim(), v.join('='));
      res.headers.append('set-cookie', sc);
    }
    const headers = new Headers(req.headers);
    headers.set('cookie', [...reqCookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const forwarded = NextResponse.next({ request: { headers } });
    for (const sc of setCookies) forwarded.headers.append('set-cookie', sc);
    return forwarded;
  } catch {
    return NextResponse.next();
  }
}

export const config = { matcher: ['/((?!api/|_next/|favicon|icon|apple-icon|robots.txt|sitemap|manifest|.*\\.(?:svg|png|jpg|webp|ico|txt|xml)$).*)'] };
