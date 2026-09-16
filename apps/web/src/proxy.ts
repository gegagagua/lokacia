import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, LOCALE_COOKIE, LOCALE_HEADER, PATHNAME_HEADER, localizePath, splitLocalePath, type Locale } from '@/i18n/locale';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const YEAR = 60 * 60 * 24 * 365;

function persistLocale(res: NextResponse, locale: Locale, current: string | undefined) {
  if (current !== locale) res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  return res;
}

/**
 * Next 16 proxy:
 * 1. Locale routing (Phase 22) — ka at the root, `/en/*` and `/ru/*` are rewritten to the same routes with `x-lk-locale`;
 *    `/ka/*` redirects to the root; unprefixed page requests of a visitor who chose en/ru (cookie) redirect to the prefixed URL.
 * 2. Silent session refresh — when the 15-minute access cookie expired but the refresh cookie exists, rotate tokens before
 *    rendering so server components see the user.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const { locale: prefix, path } = splitLocalePath(pathname);
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const isRead = req.method === 'GET' || req.method === 'HEAD';

  if (prefix === 'ka') {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return persistLocale(NextResponse.redirect(url, 308), 'ka', cookieLocale);
  }
  if (!prefix && isRead && isLocale(cookieLocale) && cookieLocale !== 'ka') {
    const url = req.nextUrl.clone();
    url.pathname = localizePath(path, cookieLocale);
    return NextResponse.redirect(url, 307);
  }
  const locale: Locale = prefix ?? 'ka';

  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, locale);
  headers.set(PATHNAME_HEADER, path);
  const setCookies: string[] = [];

  const refresh = req.cookies.get('lk_rt')?.value;
  if (!req.cookies.has('lk_at') && refresh) {
    try {
      const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { cookie: `lk_rt=${refresh}`, 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' } });
      if (!r.ok) {
        setCookies.push('lk_rt=; Path=/; Max-Age=0');
      } else {
        // make new cookies visible to this request and persist them in the browser
        const reqCookies = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
        for (const sc of r.headers.getSetCookie()) {
          const [pair] = sc.split(';');
          const [name, ...v] = pair!.split('=');
          reqCookies.set(name!.trim(), v.join('='));
          setCookies.push(sc);
        }
        headers.set('cookie', [...reqCookies].map(([k, v]) => `${k}=${v}`).join('; '));
      }
    } catch {
      // API unreachable — render logged out
    }
  }

  const res = prefix ? NextResponse.rewrite(new URL(`${path}${search}`, req.url), { request: { headers } }) : NextResponse.next({ request: { headers } });
  for (const sc of setCookies) res.headers.append('set-cookie', sc);
  return prefix ? persistLocale(res, locale, cookieLocale) : res;
}

export const config = { matcher: ['/((?!api/|_next/|favicon|icon|apple-icon|robots.txt|sitemap|manifest|.*\\.(?:svg|png|jpg|webp|ico|txt|xml)$).*)'] };
