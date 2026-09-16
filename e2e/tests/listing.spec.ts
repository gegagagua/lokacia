import { expect, test } from '@playwright/test';
import { listingPath } from '../lib/pages';

test.describe('listing page', () => {
  test('shows technical passport and reveals phone on click', async ({ page }) => {
    const path = await listingPath();
    test.fixme(!path, 'awaiting portal listing stream: listing page route not built yet (tried /listings/:slug, /listings/:id, /l/:slug) — lead re-runs later');

    await page.goto(path!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // SpacePlan signature drawing + passport section
    await expect(page.getByRole('img', { name: /ნახაზი/ }).first()).toBeVisible();
    await expect(page.getByText(/ტექნიკური პასპორტი/).first()).toBeVisible();

    const reveal = page.getByRole('button', { name: 'ნომრის ჩვენება' });
    await expect(reveal).toBeVisible();
    // Phone must be hidden before the click (personal data rule).
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    const revealResponse = page.waitForResponse((r) => r.url().includes('/reveal-phone'));
    await reveal.click();
    expect((await revealResponse).ok()).toBeTruthy();
    await expect(page.locator('a[href^="tel:+995"]').first()).toBeVisible();
  });
});
