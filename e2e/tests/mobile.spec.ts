import { expect, test } from '@playwright/test';
import { PUBLIC_PAGES, requirePage, settle } from '../lib/pages';

for (const width of [360, 375]) {
  test.describe(`no horizontal scroll at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    for (const path of PUBLIC_PAGES) {
      test(`${path} @mobile`, async ({ page }) => {
        await requirePage(path);
        await page.goto(path);
        await settle(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
      });
    }
  });
}
