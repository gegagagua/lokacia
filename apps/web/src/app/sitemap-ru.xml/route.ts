import { localeSitemapIds, renderSitemapIndex, XML_HEADERS } from '@/components/portal/sitemap-data';

export const revalidate = 3600;

/** Russian sitemap index: `/sitemaps/ru-<id>.xml` with /ru-prefixed URLs and hreflang alternates. */
export async function GET() {
  return new Response(renderSitemapIndex(await localeSitemapIds('ru')), { headers: XML_HEADERS });
}
