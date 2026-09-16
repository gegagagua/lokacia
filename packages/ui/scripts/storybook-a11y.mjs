#!/usr/bin/env node
/**
 * Accessibility audit of every Storybook story (light + dark theme) with axe-core in real Chromium.
 * Usage: pnpm --filter @lokacia/ui build-storybook && pnpm --filter @lokacia/ui test:a11y
 * Env: STORYBOOK_DIR (default storybook-static), A11Y_ONLY (substring filter on story id), A11Y_THEMES (light,dark)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.STORYBOOK_DIR ?? 'storybook-static');
const themes = (process.env.A11Y_THEMES ?? 'light,dark').split(',');
const only = process.env.A11Y_ONLY;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Map canvases render third-party tiles (OSM attribution etc.) we don't control.
const EXCLUDE = ['.maplibregl-ctrl-attrib', '.maplibregl-canvas'];

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = path.join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter((e) => e.type === 'story' && (!only || e.id.includes(only)));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
let failures = 0;
for (const s of stories) {
  for (const theme of themes) {
    await page.goto(`${base}/iframe.html?id=${s.id}&viewMode=story&globals=theme:${theme}`, { waitUntil: 'load' });
    await page.waitForSelector('#storybook-root > *', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    let builder = new AxeBuilder({ page }).withTags(TAGS);
    for (const sel of EXCLUDE) builder = builder.exclude(sel);
    // The Storybook a11y addon runs axe itself after render; retry while that run is in progress.
    let violations;
    for (let attempt = 0; ; attempt++) {
      try {
        ({ violations } = await builder.analyze());
        break;
      } catch (e) {
        if (attempt > 20 || !String(e).includes('Axe is already running')) throw e;
        await page.waitForTimeout(300);
      }
    }
    if (violations.length) {
      failures += violations.length;
      console.log(`✗ ${s.id} [${theme}]`);
      for (const v of violations) console.log(`   ${v.impact} ${v.id}: ${v.help}\n     ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n     ')}`);
    } else console.log(`✓ ${s.id} [${theme}]`);
  }
}
await browser.close();
server.close();
console.log(`\n${stories.length} stories × ${themes.length} themes, ${failures} violation(s)`);
process.exit(failures ? 1 : 0);
