import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { listingPath, PUBLIC_PAGES, requirePage, settle } from '../lib/pages';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await settle(page);
  // Map canvases are third-party (MapLibre) — audited via our own controls only.
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude('.maplibregl-canvas').analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(' | ')}`);
  expect(summary, `axe violations on ${path}:\n${summary.join('\n')}`).toEqual([]);
}

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const path of PUBLIC_PAGES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${path} [${theme}]`, async ({ page }) => {
        await requirePage(path);
        await page.emulateMedia({ colorScheme: theme });
        await audit(page, path);
      });
    }
  }

  test('listing page', async ({ page }) => {
    const path = await listingPath();
    test.fixme(!path, 'awaiting portal listing stream: listing page route not built yet');
    await audit(page, path!);
  });
});
