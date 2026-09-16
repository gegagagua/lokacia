import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const PRIVATE = ['/account', '/login', '/checkout', '/confirm', '/compare/', '/alerts/', '/demand/new', '/listings/*/book', '/listings/*/offer', '/search?*bbox='];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // private paths in every language version (ka at the root, /en and /ru prefixed)
        disallow: ['/api/', ...PRIVATE, ...PRIVATE.map((p) => `/en${p}`), ...PRIVATE.map((p) => `/ru${p}`)],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap-en.xml`, `${SITE_URL}/sitemap-ru.xml`],
    host: SITE_URL,
  };
}
