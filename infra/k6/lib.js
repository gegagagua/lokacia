// Shared helpers for k6 scripts. k6 runs its own JS runtime (goja) — no Node APIs.
import http from 'k6/http';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
export const WEB_URL = (__ENV.WEB_URL || 'http://localhost:3100').replace(/\/$/, '');

export const BUSINESS_TYPES = ['cafe', 'bar', 'bakery', 'retail', 'pharmacy', 'beauty-salon', 'clinic', 'office', 'coworking', 'warehouse', 'showroom', 'fitness'];
export const DISTRICTS = ['vake', 'saburtalo', 'mtatsminda', 'vera', 'didube', 'isani', 'gldani', 'nadzaladevi', 'sololaki', 'old-tbilisi'];
export const DEAL_TYPES = ['rent', 'sale'];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Stages from env: SMOKE=1 → tiny run; otherwise ramp to TARGET_VUS (default 50). */
export function stages() {
  if (__ENV.SMOKE) return [{ duration: '10s', target: 2 }];
  const vus = Number(__ENV.TARGET_VUS || 50);
  return [
    { duration: '30s', target: Math.ceil(vus / 5) },
    { duration: '1m', target: vus },
    { duration: '3m', target: vus },
    { duration: '30s', target: 0 },
  ];
}

/** Fetch a pool of real listing slugs once in setup(). */
export function listingSlugs(n = 200) {
  const res = http.get(`${BASE_URL}/v1/listings?limit=${Math.min(n, 500)}`, { tags: { name: 'setup' } });
  if (res.status !== 200) throw new Error(`setup: GET /v1/listings → ${res.status}`);
  const items = res.json('items') || [];
  if (!items.length) throw new Error('setup: no listings — seed the load-test database first (pnpm load:seed)');
  return items.map((i) => i.slug || i.id);
}
