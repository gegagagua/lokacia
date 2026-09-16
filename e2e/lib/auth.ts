import { existsSync } from 'node:fs';
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';
import { OTP_CODE, WEB_URL } from './env';

/** Georgian problem title returned with HTTP 429 (see apps/api problems.tooMany). */
export const RATE_LIMITED_TEXT = /ძალიან ბევრი მოთხოვნა/;

/**
 * Log in through the same-origin rewrite (`WEB_URL/api/v1/auth/...`) so the httpOnly cookies
 * (`lk_at`, `lk_rt`) are stored for the web host. Cookies on `localhost` ignore the port,
 * so the same storage state also works for CRM (3101) and admin (3102).
 */
export async function otpLogin(ctx: APIRequestContext, phone: string) {
  const req = await ctx.post('/api/v1/auth/otp/request', { data: { phone } });
  if (!req.ok()) throw new Error(`otp/request ${phone} → ${req.status()} ${await req.text()}`);
  const verify = await ctx.post('/api/v1/auth/otp/verify', { data: { phone, code: OTP_CODE } });
  if (!verify.ok()) throw new Error(`otp/verify ${phone} → ${verify.status()} ${await verify.text()}`);
  return (await verify.json()) as { user: { id: string } };
}

/**
 * Write storage state for a role. OTP requests are rate limited (5/phone/h, 20/IP/h), so an
 * existing state is reused by rotating its refresh cookie first; OTP login is the fallback.
 */
export async function saveRoleState(phone: string, file: string) {
  if (existsSync(file)) {
    const ctx = await request.newContext({ baseURL: WEB_URL, storageState: file });
    try {
      const res = await ctx.post('/api/v1/auth/refresh');
      const me = res.ok() ? await ctx.get('/api/v1/auth/me') : null;
      const body = me?.ok() ? ((await me.json()) as { phone?: string }) : null;
      if (body && (!body.phone || body.phone === phone)) {
        await ctx.storageState({ path: file });
        return 'refreshed' as const;
      }
    } finally {
      await ctx.dispose();
    }
  }
  const ctx = await request.newContext({ baseURL: WEB_URL });
  try {
    await otpLogin(ctx, phone);
    await ctx.storageState({ path: file });
    return 'otp' as const;
  } finally {
    await ctx.dispose();
  }
}

/** Skip (not fail) when the shared dev API has exhausted the OTP rate limit for this IP/phone. */
async function skipIfRateLimited(page: Page) {
  const alert = page.getByRole('alert').filter({ hasText: /\S/ });
  if ((await alert.count()) && RATE_LIMITED_TEXT.test((await alert.first().textContent()) ?? '')) {
    test.skip(true, 'OTP rate limit reached on the shared dev API (5/phone/h, 20/IP/h) — re-run later or flush rl:otp:* in Redis');
  }
}

/** Fill the phone step of /login and move to the code step. */
export async function requestCodeViaUi(page: Page, phone: string, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('ტელეფონის ნომერი').fill(phone.replace('+995', ''));
  await page.getByRole('button', { name: 'კოდის გაგზავნა' }).click();
  const code = page.locator('input[autocomplete="one-time-code"]');
  await expect(code.or(page.getByRole('alert').filter({ hasText: /\S/ }))).toBeVisible();
  await skipIfRateLimited(page);
  await expect(code).toBeVisible();
  return code;
}

/** UI login via /login (phone → dev OTP code → shesvla). */
export async function uiLogin(page: Page, phone: string, next = '/') {
  const code = await requestCodeViaUi(page, phone, next);
  await code.fill(OTP_CODE);
  await page.getByRole('button', { name: 'შესვლა', exact: true }).click();
}
