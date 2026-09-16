// node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTrees, flatten, icuSignature } from './i18n-check-lib.mjs';

test('icuSignature collects simple arguments and ignores literal text', () => {
  assert.deepEqual(icuSignature('Commission {pct}% · {price} / m²'), ['pct', 'price']);
  assert.deepEqual(icuSignature('No placeholders'), []);
});

test('icuSignature handles plural/select without comparing option keys', () => {
  const ka = '{count, plural, other {# ფართი}}';
  const ru = '{count, plural, one {# помещение} few {# помещения} many {# помещений} other {# помещения}}';
  assert.deepEqual(icuSignature(ka), ['count:plural']);
  assert.deepEqual(icuSignature(ru), ['count:plural']);
  assert.deepEqual(icuSignature('{role, select, owner {Owner {name}} other {—}}'), ['name', 'role:select']);
});

test('icuSignature collects rich-text tags and number styles', () => {
  assert.deepEqual(icuSignature('Read <b>terms</b> by {date, date, short}'), ['<b>', 'date:date']);
});

test('icuSignature throws on unbalanced braces', () => {
  assert.throws(() => icuSignature('Hello {name'));
  assert.throws(() => icuSignature('Hello name}'));
});

test('flatten produces dotted keys', () => {
  assert.deepEqual(flatten({ a: { b: 'x', c: { d: 'y' } } }), { 'a.b': 'x', 'a.c.d': 'y' });
});

test('compareTrees passes a correct translation', () => {
  const ka = { nav: { search: 'ძებნა', count: '{n} ფართი' } };
  assert.deepEqual(compareTrees(ka, { nav: { search: 'Search', count: '{n} spaces' } }), []);
});

test('compareTrees reports missing, extra, empty, Georgian and placeholder problems', () => {
  const ka = { a: 'ერთი', b: 'ორი {n}', c: 'სამი', d: 'ოთხი' };
  const en = { a: '', b: 'Two {count}', c: 'Three ბ', e: 'extra' };
  const problems = compareTrees(ka, en);
  assert.ok(problems.some((p) => p.startsWith('a: empty string')));
  assert.ok(problems.some((p) => p.startsWith('b: placeholders differ')));
  assert.ok(problems.some((p) => p.startsWith('c: contains Georgian letters')));
  assert.ok(problems.some((p) => p.startsWith('d: missing key')));
  assert.ok(problems.some((p) => p.startsWith('e: extra key')));
  assert.equal(problems.length, 5);
});

test('compareTrees reports whitespace-only and non-string values', () => {
  const problems = compareTrees({ a: 'ა', b: 'ბ' }, { a: '   ', b: { nested: 'x' } });
  assert.ok(problems.includes('a: empty string'));
  assert.ok(problems.some((p) => p.startsWith('b.nested: extra key')));
  assert.ok(problems.some((p) => p.startsWith('b: missing key')));
});
