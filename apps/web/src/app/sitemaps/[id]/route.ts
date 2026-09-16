import { parseSitemapId, renderUrlset, sitemapEntries, sitemapIds, XML_HEADERS } from '@/components/portal/sitemap-data';

export const revalidate = 3600;

/** Child sitemap `/sitemaps/<id>.xml` (ka) or `/sitemaps/<en|ru>-<id>.xml`, listed in the sitemap indexes. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const { locale, id } = parseSitemapId(raw.replace(/\.xml$/, ''));
  if (!(await sitemapIds()).includes(id)) return new Response('Not found', { status: 404 });
  return new Response(renderUrlset(await sitemapEntries(id, locale)), { headers: XML_HEADERS });
}
