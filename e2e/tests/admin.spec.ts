import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../lib/env';
import { requirePage } from '../lib/pages';
import { storageStateFor } from '../lib/roles';

test.use({ storageState: storageStateFor('moderator') });

test.describe('admin smoke', () => {
  test('moderator opens the moderation queue', async ({ page }) => {
    await requirePage('/', 'admin stream (apps/admin)', ADMIN_URL);
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
    const queueLink = page.getByRole('link', { name: /მოდერაცი/ }).first();
    if (await queueLink.isVisible().catch(() => false)) await queueLink.click();
    else await page.goto('/moderation');
    await expect(page.getByRole('heading', { name: /მოდერაცი/ }).first()).toBeVisible();
  });
});
