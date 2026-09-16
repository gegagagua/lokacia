import { expect, test } from '@playwright/test';
import { requestCodeViaUi, uiLogin } from '../lib/auth';
import { UI_LOGIN_PHONES as ROLES } from '../lib/roles';
import { routeStatus } from '../lib/pages';
import { WEB_URL } from '../lib/env';

test.describe('auth', () => {
  test('OTP login via /login lands on next page with a session', async ({ page }) => {
    await uiLogin(page, ROLES.agent, '/');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 });
    const me = await page.request.get('/api/v1/auth/me');
    expect(me.ok()).toBeTruthy();
    const cookies = await page.context().cookies();
    const at = cookies.find((c) => c.name === 'lk_at');
    expect(at?.httpOnly).toBe(true);
    // Header shows the user menu instead of the login link.
    await expect(page.getByRole('link', { name: 'შესვლა', exact: true })).toHaveCount(0);
  });

  test('wrong OTP code shows a Georgian error', async ({ page }) => {
    const code = await requestCodeViaUi(page, ROLES.developer);
    await code.fill('000000');
    await page.getByRole('button', { name: 'შესვლა', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText(/[ა-ჰ]/);
  });

  for (const path of ['/account', '/account/listings', '/account/favorites', '/account/profile']) {
    test(`logged-out ${path} redirects to /login?next=`, async ({ page }) => {
      const status = await routeStatus(`${WEB_URL}${path}`);
      test.fixme(status === 404, `awaiting account stream: ${path} → 404 (not built yet)`);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%2F/g, '(%2F|/)')}`));
    });
  }
});
