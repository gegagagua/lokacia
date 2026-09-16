import { localeSitemapIds, renderSitemapIndex, XML_HEADERS } from '@/components/portal/sitemap-data';

export const revalidate = 3600;

/** English sitemap index: `/sitemaps/en-<id>.xml` with /en-prefixed URLs and hreflang alternates. */
export async function GET() {
  return new Response(renderSitemapIndex(await localeSitemapIds('en')), { headers: XML_HEADERS });
}
