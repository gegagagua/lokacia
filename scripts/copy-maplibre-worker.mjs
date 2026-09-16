#!/usr/bin/env node
// MapLibre v6 resolves its module worker relative to import.meta.url, which breaks inside Next bundles.
// Copy the worker + shared chunk into the app's public/ folder; MapView calls setWorkerUrl('/maplibre/…').
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const appDir = process.cwd();
const require = createRequire(path.join(appDir, 'package.json'));
const uiPkg = path.dirname(require.resolve('@lokacia/ui/package.json'));
const uiRequire = createRequire(path.join(uiPkg, 'package.json'));
const dist = path.join(path.dirname(uiRequire.resolve('maplibre-gl/package.json')), 'dist');
const out = path.join(appDir, 'public', 'maplibre');
mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(path.join(dist, f), path.join(out, f));
console.log('maplibre worker copied to', path.relative(process.cwd(), out));
