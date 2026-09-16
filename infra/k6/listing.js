// k6 load test — listing detail API + SSR listing page (Phase 14).
// Run: k6 run -e BASE_URL=http://localhost:4000 -e WEB_URL=http://localhost:3100 infra/k6/listing.js
// Set PAGES=0 to test the API only (e.g. when the web app is not deployed next to it).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, WEB_URL, listingSlugs, pick, stages } from './lib.js';

const PAGES = __ENV.PAGES !== '0';

export const options = {
  scenarios: {
    listing: { executor: 'ramping-vus', stages: stages(), gracefulRampDown: '10s' },
  },
  thresholds: {
    'http_req_duration{name:listing-api}': ['p(95)<300'],
    'http_req_duration{name:similar-api}': ['p(95)<400'],
    'http_req_duration{name:listing-page}': ['p(95)<800'], // SSR HTML (TTFB budget for LCP < 2.5 s)
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  return { slugs: listingSlugs(300) };
}

export default function (data) {
  const slug = pick(data.slugs);
  const res = http.get(`${BASE_URL}/v1/listings/${slug}`, { tags: { name: 'listing-api' } });
  check(res, { 'listing 200': (r) => r.status === 200, 'has passport': (r) => r.status === 200 && r.json('passport') !== undefined });

  if (Math.random() < 0.5) {
    const sim = http.get(`${BASE_URL}/v1/listings/${slug}/similar`, { tags: { name: 'similar-api' } });
    check(sim, { 'similar 200': (r) => r.status === 200 });
  }

  if (PAGES) {
    const page = http.get(`${WEB_URL}/listings/${slug}`, { tags: { name: 'listing-page' }, headers: { Accept: 'text/html' } });
    check(page, { 'page 200': (r) => r.status === 200, 'page has JSON-LD': (r) => String(r.body).includes('application/ld+json') });
  }
  sleep(Math.random() * 3 + 1);
}
