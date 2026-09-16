import { defineConfig, devices } from '@playwright/test';
import { ADMIN_URL, CRM_URL, WEB_URL } from './lib/env';

const CI = !!process.env.CI;

/**
 * lokacia.ge end-to-end suite. Servers run externally by default (`pnpm dev`);
 * set E2E_START_SERVERS=1 to let Playwright start the production builds.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'ka-GE',
    timezoneId: 'Asia/Tbilisi',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 45_000,
  },
  projects: [
    { name: 'setup', testDir: './setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'web-chromium',
      dependencies: ['setup'],
      testIgnore: [/crm\.spec\.ts/, /admin\.spec\.ts/],
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
    {
      name: 'web-mobile',
      dependencies: ['setup'],
      grep: /@mobile/,
      testIgnore: [/crm\.spec\.ts/, /admin\.spec\.ts/],
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 }, baseURL: WEB_URL },
    },
    { name: 'crm', dependencies: ['setup'], testMatch: /crm\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: CRM_URL } },
    { name: 'admin', dependencies: ['setup'], testMatch: /admin\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL } },
  ],
  webServer: process.env.E2E_START_SERVERS
    ? [
        { command: 'pnpm --filter @lokacia/api start', url: `${process.env.API_URL ?? 'http://localhost:4000'}/v1/health`, reuseExistingServer: true, timeout: 120_000, cwd: '..' },
        { command: 'pnpm --filter @lokacia/web start', url: WEB_URL, reuseExistingServer: true, timeout: 120_000, cwd: '..' },
        { command: 'pnpm --filter @lokacia/crm start', url: CRM_URL, reuseExistingServer: true, timeout: 120_000, cwd: '..' },
        { command: 'pnpm --filter @lokacia/admin start', url: ADMIN_URL, reuseExistingServer: true, timeout: 120_000, cwd: '..' },
      ]
    : undefined,
});
