import { expect, test, type Page } from '@playwright/test';
import { firstListing } from '../lib/pages';

/** Phase 22: ka at the root, /en and /ru prefixed versions with translated UI, hreflang and language sitemaps. */

const GEORGIAN = /[ა-ჿ]/;

async function expectHreflang(page: Page, path: string) {
  const suffix = path === '/' ? '' : path;
  const alt = (lang: string) => page.locator(`link[rel="alternate"][hreflang="${lang}"]`);
  await expect(alt('ka')).toHaveAttribute('href', new RegExp(`^https?://[^/]+${path === '/' ? '/?' : suffix}$`));
  await expect(alt('en')).toHaveAttribute('href', new RegExp(`/en${suffix}$`));
  await expect(alt('ru')).toHaveAttribute('href', new RegExp(`/ru${suffix}$`));
  await expect(alt('x-default')).toHaveAttribute('href', new RegExp(`^https?://[^/]+${path === '/' ? '/?' : suffix}$`));
}

test.describe('i18n (en/ru)', () => {
  test('/en/search renders English UI with lang, canonical and hreflang', async ({ page }) => {
    await page.goto('/en/search');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/en/search');
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(GEORGIAN);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/search$/);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
    await expectHreflang(page, '/search');
    const results = page.getByRole('article');
    if (await results.count()) await expect(results.first().getByText(/^(For rent|For sale|Business transfer|Short-term rent)$/).first()).toBeVisible();
  });

  test('/ru/listings/<slug> renders Russian UI and listing text', async ({ page }) => {
    const listing = await firstListing();
    test.skip(!listing, 'no seeded listings in API');
    await page.goto(`/ru/listings/${listing!.slug}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { name: 'Технический паспорт' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Описание' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Показать номер' }).first()).toBeAttached();
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ru_RU');
    await expectHreflang(page, `/listings/${listing!.slug}`);
    // seeded listings carry title_ru — the h1 uses it (falls back to ka only when empty)
    const api = await page.request.get(`/api/v1/listings/${listing!.slug}?track=0`);
    const detail = (await api.json()) as { title: string; titleRu?: string | null };
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(detail.titleRu || detail.title);
  });

  test('ka stays canonical at the root; /ka redirects; hreflang present on home', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\/[^/]+\/?$/);
    await expectHreflang(page, '/');
    const res = await request.get('/ka/pricing', { maxRedirects: 0 });
    expect([301, 307, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/\/pricing$/);
  });

  test('language switcher navigates to the prefixed URL and remembers the choice', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: /^ენა/ }).click();
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/pricing$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pricing');
    // unprefixed links now resolve to the chosen language
    await page.goto('/search');
    await expect(page).toHaveURL(/\/en\/search$/);
    // back to Georgian
    await page.getByRole('button', { name: /^Language/ }).click();
    await page.getByRole('link', { name: 'ქართული' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
  });

  test('sitemap-en.xml and sitemap-ru.xml list prefixed URLs with xhtml:link alternates', async ({ request }) => {
    const index = await request.get('/sitemap-en.xml');
    expect(index.status()).toBe(200);
    const indexBody = await index.text();
    expect(indexBody).toMatch(/<sitemapindex/);
    const child = /<loc>([^<]*\/sitemaps\/en-static\.xml)<\/loc>/.exec(indexBody);
    expect(child).toBeTruthy();
    const res = await request.get(new URL(child![1]!).pathname);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/en\/search<\/loc>/);
    expect(body).toMatch(/<xhtml:link rel="alternate" hreflang="ru" href="https?:\/\/[^"]+\/ru\/search"\/>/);
    expect(body).toMatch(/hreflang="x-default"/);
    expect((await request.get('/sitemap-ru.xml')).status()).toBe(200);
    expect(await (await request.get('/sitemap.xml')).text()).toMatch(/sitemaps\/ru-static\.xml/);
  });
});
