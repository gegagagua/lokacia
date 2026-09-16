import 'server-only';
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

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

/** Child sitemap ids; `/sitemap.xml` is the index pointing at `/sitemaps/<id>.xml`. */
export async function sitemapIds(): Promise<string[]> {
  const { total } = await get<{ total: number }>('/v1/seo/sitemap/listings?page=0&size=1', { total: 0 });
  const chunks = Math.max(1, Math.ceil(total / LISTINGS_PER_SITEMAP));
  return ['static', 'business-types', 'districts', 'combos', ...Array.from({ length: chunks }, (_, i) => `listings-${i}`)];
}


const url = (p: string) => `${SITE_URL}${p}`;

export async function sitemapEntries(id: string): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  if (id === 'static') {
    const pages = ['/', '/search', '/map', '/demand', '/services', '/projects', '/brokers', '/pricing', '/reports', '/pages/about', '/pages/terms', '/pages/privacy'];
    return pages.map((p) => ({ url: url(p), lastModified: now, changeFrequency: p === '/' || p === '/search' ? 'hourly' : 'daily', priority: p === '/' ? 1 : 0.7 }));
  }
  if (id === 'business-types') {
    const types = await get<{ slug: string }[]>('/v1/taxonomy/business-types', []);
    return types.map((t) => ({ url: url(`/${t.slug}`), lastModified: now, changeFrequency: 'daily', priority: 0.8 }));
  }
  if (id === 'districts') {
    const [districts, projects, providers] = await Promise.all([
      get<{ slug: string; activeCount: number }[]>('/v1/taxonomy/districts', []),
      get<{ slug: string }[]>('/v1/projects', []),
      get<{ items: { slug: string }[] }>('/v1/services/providers?limit=60', { items: [] }),
    ]);
    return [
      ...districts.map((d) => ({ url: url(`/districts/${d.slug}`), lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
      ...projects.map((p) => ({ url: url(`/projects/${p.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
      ...providers.items.map((p) => ({ url: url(`/services/${p.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ];
  }
  if (id === 'combos') {
    const combos = await get<{ businessType: string; district: string; count: number }[]>('/v1/seo/combos', []);
    return combos.map((c) => ({ url: url(`/${c.businessType}/${c.district}`), lastModified: now, changeFrequency: 'daily', priority: c.count >= 5 ? 0.7 : 0.5 }));
  }
  const m = /^listings-(\d+)$/.exec(id);
  if (m) {
    const { items } = await get<{ items: { slug: string; updatedAt: string }[] }>(`/v1/seo/sitemap/listings?page=${m[1]}&size=${LISTINGS_PER_SITEMAP}`, { items: [] });
    return items.map((l) => ({ url: url(`/listings/${l.slug}`), lastModified: new Date(l.updatedAt), changeFrequency: 'daily', priority: 0.6 }));
  }
  return [];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderUrlset(entries: MetadataRoute.Sitemap) {
  const rows = entries.map((e) => {
    const lm = e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : '';
    const cf = e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : '';
    const pr = e.priority != null ? `<priority>${e.priority}</priority>` : '';
    return `  <url><loc>${esc(e.url)}</loc>${lm}${cf}${pr}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
