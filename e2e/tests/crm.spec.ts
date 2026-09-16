import { expect, test } from '@playwright/test';
import { CRM_URL } from '../lib/env';
import { requirePage } from '../lib/pages';
import { storageStateFor } from '../lib/roles';

test.use({ storageState: storageStateFor('agencyManager') });

test.describe('CRM smoke', () => {
  test('agency manager opens the deals pipeline', async ({ page }) => {
    await requirePage('/', 'CRM stream (apps/crm)', CRM_URL);
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
    const pipelineLink = page.getByRole('link', { name: /პაიპლაინ|გარიგებ|ვორონკა/ }).first();
    if (await pipelineLink.isVisible().catch(() => false)) await pipelineLink.click();
    else await page.goto('/pipeline');
    await expect(page.getByRole('region').or(page.getByRole('heading')).first()).toBeVisible();
  });
});
