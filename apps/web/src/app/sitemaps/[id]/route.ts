import { renderUrlset, sitemapEntries, sitemapIds } from '@/components/portal/sitemap-data';

export const revalidate = 3600;

/** Child sitemap `/sitemaps/<id>.xml` listed in the `/sitemap.xml` index. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = raw.replace(/\.xml$/, '');
  if (!(await sitemapIds()).includes(id)) return new Response('Not found', { status: 404 });
  return new Response(renderUrlset(await sitemapEntries(id)), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
