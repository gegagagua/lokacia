#!/usr/bin/env node
/**
 * Generates app icons / splash / favicon PNGs from the brand mark in packages/ui/src/brand/svg.ts (single source of truth).
 * Usage: pnpm --filter @lokacia/mobile assets
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../assets');
// Node ≥ 22.18 strips TypeScript types natively; svg.ts has no runtime TS syntax.
const brand = await import(path.resolve(here, '../../../packages/ui/src/brand/svg.ts'));
const { BRAND_COLORS, markSvg } = brand;

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 32) })
    .resize(size, size)
    .png()
    .toFile(path.join(out, file));
  console.log('wrote', `assets/${file}`, `${size}×${size}`);
}

await mkdir(out, { recursive: true });
// iOS/Android store icon: full-bleed square (iOS masks corners itself), plaster tile.
await png(markSvg({ radius: 0, padding: 4 }), 1024, 'icon.png');
// Android adaptive icon foreground: transparent, content inside the 66% safe zone.
await png(markSvg({ background: null, padding: 9 }), 1024, 'adaptive-icon.png');
await png(markSvg({ background: null, padding: 9, stroke: '#FFFFFF', dot: '#FFFFFF' }), 1024, 'adaptive-icon-mono.png');
// Splash (contain on plaster / basalt backgrounds from app.config.ts).
await png(markSvg({ background: null }), 512, 'splash-icon.png');
await png(markSvg({ background: null, stroke: '#6FB3A2' }), 512, 'splash-icon-dark.png');
// Android notification icon must be white on transparent.
await png(markSvg({ background: null, stroke: '#FFFFFF', dot: '#FFFFFF', padding: 2 }), 96, 'notification-icon.png');
await png(markSvg(), 48, 'favicon.png');
void BRAND_COLORS;
