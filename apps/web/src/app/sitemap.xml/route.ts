import { localeSitemapIds, renderSitemapIndex, XML_HEADERS } from '@/components/portal/sitemap-data';

export const revalidate = 3600;

/**
 * Sitemap index (Phase 14/22): Georgian child sitemaps plus the en/ru ones, so crawlers reading only robots.txt find every
 * language. `/sitemap-en.xml` and `/sitemap-ru.xml` are the per-language indexes (for Search Console properties).
 */
export async function GET() {
  const [ka, en, ru] = await Promise.all([localeSitemapIds('ka'), localeSitemapIds('en'), localeSitemapIds('ru')]);
  return new Response(renderSitemapIndex([...ka, ...en, ...ru]), { headers: XML_HEADERS });
}
