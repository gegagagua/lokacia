import 'server-only';
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { isLocale, languageAlternates, localizePath, type Locale } from '@/i18n/locale';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const LISTINGS_PER_SITEMAP = 10_000;

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } });
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Child sitemap ids (ka, unprefixed); `/sitemap.xml` is the index pointing at `/sitemaps/<id>.xml`. */
export async function sitemapIds(): Promise<string[]> {
  const { total } = await get<{ total: number }>('/v1/seo/sitemap/listings?page=0&size=1', { total: 0 });
  const chunks = Math.max(1, Math.ceil(total / LISTINGS_PER_SITEMAP));
  return ['static', 'business-types', 'districts', 'combos', ...Array.from({ length: chunks }, (_, i) => `listings-${i}`)];
}

/**
 * Language-specific child sitemap ids: ka → `static`, en → `en-static`, ru → `ru-static`.
 * `/sitemap-en.xml` and `/sitemap-ru.xml` are the per-language indexes.
 */
export async function localeSitemapIds(locale: Locale): Promise<string[]> {
  const ids = await sitemapIds();
  return locale === 'ka' ? ids : ids.map((id) => `${locale}-${id}`);
}

/** `en-listings-0` → { locale: 'en', id: 'listings-0' }; `static` → { locale: 'ka', id: 'static' }. */
export function parseSitemapId(raw: string): { locale: Locale; id: string } {
  const m = /^(en|ru)-(.+)$/.exec(raw);
  return m && isLocale(m[1]) ? { locale: m[1], id: m[2]! } : { locale: 'ka', id: raw };
}

/** Sitemap entry with hreflang alternates for every language version (rendered as xhtml:link). */
export type SitemapEntry = MetadataRoute.Sitemap[number] & { alternates?: { languages?: Record<string, string> } };

type EntryInput = Omit<SitemapEntry, 'url' | 'alternates'> & { path: string };

/** Unprefixed paths of a child sitemap (shared by all languages). */
async function entryInputs(id: string): Promise<EntryInput[]> {
  const now = new Date();
  if (id === 'static') {
    const pages = ['/', '/search', '/map', '/demand', '/services', '/projects', '/brokers', '/pricing', '/reports', '/pages/about', '/pages/terms', '/pages/privacy'];
    return pages.map((p) => ({ path: p, lastModified: now, changeFrequency: p === '/' || p === '/search' ? 'hourly' : 'daily', priority: p === '/' ? 1 : 0.7 }));
  }
  if (id === 'business-types') {
    const types = await get<{ slug: string }[]>('/v1/taxonomy/business-types', []);
    return types.map((t) => ({ path: `/${t.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 }));
  }
  if (id === 'districts') {
    const [districts, projects, providers] = await Promise.all([
      get<{ slug: string; activeCount: number }[]>('/v1/taxonomy/districts', []),
      get<{ slug: string }[]>('/v1/projects', []),
      get<{ items: { slug: string }[] }>('/v1/services/providers?limit=60', { items: [] }),
    ]);
    return [
      ...districts.map((d) => ({ path: `/districts/${d.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
      ...projects.map((p) => ({ path: `/projects/${p.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...providers.items.map((p) => ({ path: `/services/${p.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ];
  }
  if (id === 'combos') {
    const combos = await get<{ businessType: string; district: string; count: number }[]>('/v1/seo/combos', []);
    return combos.map((c) => ({ path: `/${c.businessType}/${c.district}`, lastModified: now, changeFrequency: 'daily', priority: c.count >= 5 ? 0.7 : 0.5 }));
  }
  const m = /^listings-(\d+)$/.exec(id);
  if (m) {
    const { items } = await get<{ items: { slug: string; updatedAt: string }[] }>(`/v1/seo/sitemap/listings?page=${m[1]}&size=${LISTINGS_PER_SITEMAP}`, { items: [] });
    return items.map((l) => ({ path: `/listings/${l.slug}`, lastModified: new Date(l.updatedAt), changeFrequency: 'daily', priority: 0.6 }));
  }
  return [];
}

/** Entries of a child sitemap in one language (ka at the root, en/ru prefixed), each with ka/en/ru/x-default alternates. */
export async function sitemapEntries(id: string, locale: Locale = 'ka'): Promise<SitemapEntry[]> {
  return (await entryInputs(id)).map(({ path, ...rest }) => ({
    url: `${SITE_URL}${localizePath(path, locale)}`,
    ...rest,
    alternates: { languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, p]) => [lang, `${SITE_URL}${p}`])) },
  }));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderUrlset(entries: SitemapEntry[]) {
  const rows = entries.map((e) => {
    const lm = e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : '';
    const cf = e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : '';
    const pr = e.priority != null ? `<priority>${e.priority}</priority>` : '';
    const alt = Object.entries(e.alternates?.languages ?? {})
      .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${esc(lang)}" href="${esc(String(href))}"/>`)
      .join('');
    return `  <url><loc>${esc(e.url)}</loc>${lm}${cf}${pr}${alt}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

export function renderSitemapIndex(ids: string[]) {
  const lastmod = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ids.map((id) => `  <sitemap><loc>${SITE_URL}/sitemaps/${id}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`;
}

export const XML_HEADERS = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' };
