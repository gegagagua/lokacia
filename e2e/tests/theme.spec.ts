import { expect, test } from '@playwright/test';

test.describe('theme', () => {
  test('header toggle switches data-theme and persists across reload @mobile', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: 'თემის შეცვლა' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const bgDark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    expect(bgDark.toLowerCase()).not.toBe('#edf0eb');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'თემის შეცვლა' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});
