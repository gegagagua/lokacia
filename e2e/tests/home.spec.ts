import { expect, test } from '@playwright/test';
import { trackConsoleErrors, settle } from '../lib/pages';

test.describe('home', () => {
  test('loads with header, main landmark and no console errors @mobile', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/lokacia/i);
    await expect(page.getByRole('link', { name: /lokacia\.ge — მთავარი/ })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
    await settle(page);
    expect(errors, `console errors on /:\n${errors.join('\n')}`).toEqual([]);
  });

  test('primary CTA leads to search', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('main a[href^="/search"]').first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /\/search/);
  });
});
