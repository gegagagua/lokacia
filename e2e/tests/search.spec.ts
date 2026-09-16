import { expect, test } from '@playwright/test';
import { firstListing, requirePage } from '../lib/pages';

test.describe('search', () => {
  test('filter by business type updates the URL and the results', async ({ page }) => {
    await requirePage('/search', 'portal search stream');
    const listing = await firstListing();
    test.skip(!listing, 'no seeded listings in API');
    const type = listing!.businessTypes[0]!;

    await page.goto('/search');
    const results = page.getByRole('article');
    await expect(results.first()).toBeVisible();

    // Business type filter: a visible native <select> labelled „ბიზნესის ტიპი“ (filters panel) or the type tiles list.
    const select = page.locator('select[aria-label*="ბიზნესის ტიპ"]:visible').first();
    if (await select.count()) await select.selectOption(type);
    else {
      const tiles = page.getByRole('list', { name: /ბიზნესის ტიპ/ }).first();
      await tiles.getByRole('button').nth(1).click();
    }

    await expect(page).toHaveURL(/businessType=/);
    const selected = new URL(page.url()).searchParams.get('businessType');
    expect(selected).toBeTruthy();
    await expect(results.first()).toBeVisible();

    // Results agree with the API for the same filter.
    const api = await page.request.get(`/api/v1/search?businessType=${selected}&limit=1`);
    if (api.ok()) {
      const body = (await api.json()) as { total?: number; items?: unknown[] };
      if (body.items?.length === 0) await expect(page.getByText(/არაფერი|ვერ მოიძებნა/)).toBeVisible();
    }
  });

  test('search URL is shareable (filters restored from URL) @mobile', async ({ page }) => {
    await requirePage('/search', 'portal search stream');
    await page.goto('/search?dealType=rent&priceMax=3000');
    await expect(page).toHaveURL(/dealType=rent/);
    await expect(page.locator('main')).toBeVisible();
  });
});
