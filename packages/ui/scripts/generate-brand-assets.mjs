#!/usr/bin/env node
/**
 * Renders favicon/PWA PNGs from the brand SVGs (src/brand/svg.ts) with headless Chromium — no image deps.
 * Usage: node scripts/generate-brand-assets.mjs <appDir>   (e.g. ../../apps/web)
 * Writes: <appDir>/src/app/{icon.svg,apple-icon.png}  (Next metadata files)
 *         <appDir>/public/{icon-192.png,icon-512.png,icon-maskable-512.png,favicon-32.png,logo.svg,logo-dark.svg}
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const appDir = path.resolve(process.argv[2] ?? '../../apps/web');
// Node ≥ 22.18 strips TypeScript types natively; svg.ts has no runtime TS syntax.
const brand = await import('../src/brand/svg.ts');

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await writeFile(file, await page.locator('svg').screenshot({ omitBackground: true }));
  console.log('wrote', path.relative(process.cwd(), file));
}

const app = path.join(appDir, 'src/app');
const pub = path.join(appDir, 'public');
await mkdir(pub, { recursive: true });
await writeFile(path.join(app, 'icon.svg'), brand.MARK_SVG_LIGHT);
await png(brand.MARK_SVG_APPLE, 180, path.join(app, 'apple-icon.png'));
await png(brand.MARK_SVG_LIGHT, 32, path.join(pub, 'favicon-32.png'));
await png(brand.MARK_SVG_LIGHT, 192, path.join(pub, 'icon-192.png'));
await png(brand.MARK_SVG_LIGHT, 512, path.join(pub, 'icon-512.png'));
await png(brand.MARK_SVG_MASKABLE, 512, path.join(pub, 'icon-maskable-512.png'));
await writeFile(path.join(pub, 'logo.svg'), brand.lockupSvg());
await writeFile(path.join(pub, 'logo-dark.svg'), brand.lockupSvg({ dark: true }));
await browser.close();
