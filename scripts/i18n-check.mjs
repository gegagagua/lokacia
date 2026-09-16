#!/usr/bin/env node
// Translation completeness check (Phase 22): apps/*/messages/{en,ru}/*.json must mirror messages/ka/*.json —
// same keys, no empty strings, identical ICU placeholders/tags, no Georgian letters.
// Usage: node scripts/i18n-check.mjs [--app web] [--locale en] [--file common] [--all]
// Apps are opted in via TRANSLATED_APPS (apps/mobile still ships empty en/ru placeholders); --app or --all checks any app.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { compareTrees, flatten } from './i18n-check-lib.mjs';

const TARGET_LOCALES = ['en', 'ru'];
const TRANSLATED_APPS = ['web', 'crm', 'admin'];
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const onlyApp = opt('app');
const onlyLocale = opt('locale');
const onlyFile = opt('file');
const all = args.includes('--all');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let problems = 0;
let checked = 0;
let files = 0;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`${path.relative(root, file)}: invalid JSON (${e.message})`);
    problems++;
    return null;
  }
}

for (const app of readdirSync(path.join(root, 'apps'))) {
  if (onlyApp ? app !== onlyApp : !all && !TRANSLATED_APPS.includes(app)) continue;
  const kaDir = path.join(root, 'apps', app, 'messages', 'ka');
  if (!existsSync(kaDir)) continue;
  const namespaces = readdirSync(kaDir).filter((f) => f.endsWith('.json'));
  for (const locale of TARGET_LOCALES) {
    if (onlyLocale && locale !== onlyLocale) continue;
    const dir = path.join(root, 'apps', app, 'messages', locale);
    for (const f of namespaces) {
      if (onlyFile && f !== `${onlyFile}.json`) continue;
      const rel = path.relative(root, path.join(dir, f));
      const source = readJson(path.join(kaDir, f));
      if (!source) continue;
      files++;
      if (!existsSync(path.join(dir, f))) {
        console.error(`${rel}: missing file`);
        problems++;
        continue;
      }
      const target = readJson(path.join(dir, f));
      if (!target) continue;
      checked += Object.keys(flatten(source)).length;
      for (const p of compareTrees(source, target)) {
        console.error(`${rel}: ${p}`);
        problems++;
      }
    }
    if (existsSync(dir))
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && !namespaces.includes(x))) {
        if (onlyFile && f !== `${onlyFile}.json`) continue;
        console.error(`${path.relative(root, path.join(dir, f))}: extra file (no ka source)`);
        problems++;
      }
  }
}

if (problems) {
  console.error(`check:i18n — ${problems} problem(s) in ${checked} strings across ${files} files`);
  process.exit(1);
}
console.log(`check:i18n — ${checked} strings OK across ${files} files (en, ru)`);
