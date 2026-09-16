// k6 load test — search API (Phase 14). Run: k6 run -e BASE_URL=http://localhost:4000 infra/k6/search.js
// Threshold: p95 < 300 ms on the search API, < 1% errors. Seed 50 000 listings first (docs/OPERATIONS.md).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, BUSINESS_TYPES, DEAL_TYPES, DISTRICTS, pick, stages } from './lib.js';

export const options = {
  scenarios: {
    search: { executor: 'ramping-vus', stages: stages(), gracefulRampDown: '10s' },
  },
  thresholds: {
    'http_req_duration{name:search}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{name:search-map}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function query() {
  const p = [`businessType=${pick(BUSINESS_TYPES)}`, `dealType=${pick(DEAL_TYPES)}`, 'city=tbilisi', `limit=24`];
  const r = Math.random();
  if (r < 0.5) p.push(`districts=${pick(DISTRICTS)}`);
  if (r < 0.3) p.push(`areaMin=${pick([30, 50, 80, 120])}`, `priceMax=${pick([1500, 3000, 6000, 12000])}`);
  if (r > 0.8) p.push(`sort=${pick(['newest', 'price_asc', 'price_desc'])}`);
  if (r > 0.9) p.push(`q=${encodeURIComponent(pick(['ვაკე', 'მეტრო', 'კაფე', 'ოფისი']))}`);
  return p.join('&');
}

export default function () {
  const q = query();
  const res = http.get(`${BASE_URL}/v1/listings?${q}`, { tags: { name: 'search' } });
  check(res, {
    'search 200': (r) => r.status === 200,
    'search has items array': (r) => Array.isArray(r.json('items')),
  });

  // Cursor page 2 for ~30% of users.
  const cursor = res.status === 200 ? res.json('nextCursor') : null;
  if (cursor && Math.random() < 0.3) {
    const page2 = http.get(`${BASE_URL}/v1/listings?${q}&cursor=${encodeURIComponent(cursor)}`, { tags: { name: 'search' } });
    check(page2, { 'page 2 200': (r) => r.status === 200 });
  }

  // Map view for ~20% of users (Tbilisi bbox).
  if (Math.random() < 0.2) {
    const map = http.get(`${BASE_URL}/v1/listings/map?bbox=44.70,41.65,44.90,41.80&businessType=${pick(BUSINESS_TYPES)}`, { tags: { name: 'search-map' } });
    check(map, { 'map 200': (r) => r.status === 200 });
  }
  sleep(Math.random() * 2 + 0.5);
}
