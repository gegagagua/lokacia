import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';

const css = readFileSync(path.resolve(__dirname, '../../tokens.css'), 'utf8');
function block(selector: string) {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}
const raw = block(':root {');
const resolve = (vars: Record<string, string>, v: string): string => {
  const ref = v.match(/var\(--([\w-]+)\)/);
  return ref ? resolve(vars, vars[ref[1]!] ?? raw[ref[1]!]!) : v;
};

describe('BRAND.md color contrast (WCAG 2.2 AA)', () => {
  for (const [name, vars] of [['light', raw], ['dark', { ...raw, ...block(":root[data-theme='dark']") }]] as const) {
    const c = (a: string, b: string) => contrast(resolve(vars, vars[a]!), resolve(vars, vars[b]!));
    it(`${name}: body text ≥ 4.5`, () => {
      expect(c('text', 'bg')).toBeGreaterThanOrEqual(4.5);
      expect(c('text', 'surface')).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: muted text ≥ 4.5`, () => {
      expect(c('text-muted', 'bg')).toBeGreaterThanOrEqual(4.5);
      expect(c('text-muted', 'surface')).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: primary button ≥ 4.5`, () => expect(c('primary-contrast', 'primary')).toBeGreaterThanOrEqual(4.5));
    it(`${name}: links and errors ≥ 4.5`, () => {
      expect(c('link', 'bg')).toBeGreaterThanOrEqual(4.5);
      expect(c('danger', 'bg')).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: accent label ≥ 4.5`, () => expect(c('accent-contrast', 'accent')).toBeGreaterThanOrEqual(4.5));
    it(`${name}: focus ring ≥ 3`, () => expect(c('focus', 'bg')).toBeGreaterThanOrEqual(3));
  }
});
