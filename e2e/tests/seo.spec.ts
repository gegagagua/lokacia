import { expect, test } from '@playwright/test';
import { listingPath, PUBLIC_PAGES, requirePage } from '../lib/pages';

const INDEXABLE = PUBLIC_PAGES.filter((p) => p !== '/login');

test.describe('SEO', () => {
  for (const path of INDEXABLE) {
    test(`${path} has title, description, canonical, og:image`, async ({ page }) => {
      await requirePage(path);
      await page.goto(path);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(5);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S{10,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
      await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https?:\/\//);
      await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute('content', /\S/);
    });
  }

  test('/login is not indexable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('listing page has JSON-LD RealEstateListing / Offer', async ({ page }) => {
    const path = await listingPath();
    test.fixme(!path, 'awaiting portal listing stream: listing page route not built yet');
    await page.goto(path!);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    const types = blocks.flatMap((b) => {
      const j = JSON.parse(b) as unknown;
      const items = Array.isArray(j) ? j : [j];
      return items.flatMap((i) => {
        const o = i as { '@type'?: string | string[]; '@graph'?: { '@type'?: string }[] };
        return [o['@type'], ...(o['@graph']?.map((g) => g['@type']) ?? [])].flat().filter(Boolean) as string[];
      });
    });
    expect(types.some((t) => /RealEstateListing|Offer|Place|Product/.test(t))).toBeTruthy();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);
  });

  for (const file of ['/sitemap.xml', '/robots.txt']) {
    test(`${file} is reachable`, async ({ request }) => {
      await requirePage(file, 'SEO stream');
      const res = await request.get(file);
      expect(res.status()).toBe(200);
      const body = await res.text();
      if (file === '/robots.txt') expect(body).toMatch(/Sitemap:\s*https?:\/\//i);
      else expect(body).toMatch(/<(urlset|sitemapindex)/);
    });
  }
});
