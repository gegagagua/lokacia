#!/usr/bin/env node
// Load/regression smoke for the Phase 16–25 modules (Node ≥ 22, no dependencies; k6 is not installed on dev machines).
//
//   node infra/load/new-modules.mjs                         # 20 concurrent clients, 30 s, against http://localhost:4000
//   BASE_URL=http://localhost:4010 CONCURRENCY=50 DURATION_S=120 node infra/load/new-modules.mjs
//
// Scenarios (weighted round-robin per client):
//   billing.plans     GET /v1/billing/plans                         public, cached 60 s at the edge
//   crm.deals         GET /v1/crm/deals?limit=50                   CRM manager session (dev OTP) + x-org-id, RLS transaction
//   v2.score          GET /v1/v2/listings/:id/score                 public; only listings whose score already exists (no AI calls)
//   public.districts  GET /v1/public/districts                     analytics API key (x-api-key), metered + per-key rate limit
//
// Thresholds (exit code 1 when violated): p95 < 300 ms per scenario, non-429 error rate < 1 %.
// 429s are counted separately: they prove the limiter works and are excluded from latency stats.
// Use a dedicated DB for long runs (see docs/OPERATIONS.md §6); the script only reads, except API-key usage metering.

const BASE = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const DURATION_S = Number(process.env.DURATION_S ?? 30);
const PHONE = process.env.CRM_PHONE ?? '+995500000004'; // demo agency manager
const OTP = process.env.OTP_CODE ?? '123456';
const API_KEY = process.env.API_KEY ?? 'lk_demo_analytics_key_123456';
const P95_MS = Number(process.env.P95_MS ?? 300);

const stats = new Map();
const record = (name, ms, status) => {
  const s = stats.get(name) ?? { lat: [], ok: 0, err: 0, limited: 0, codes: {} };
  s.codes[status] = (s.codes[status] ?? 0) + 1;
  if (status === 429) s.limited++;
  else if (status >= 200 && status < 400) {
    s.ok++;
    s.lat.push(ms);
  } else s.err++;
  stats.set(name, s);
};

async function timed(name, url, init) {
  const t0 = performance.now();
  let status = 0;
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    status = res.status;
    await res.arrayBuffer();
  } catch {
    status = 599;
  }
  record(name, performance.now() - t0, status);
}

async function setup() {
  const login = await fetch(`${BASE}/v1/auth/otp/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: PHONE, code: OTP }) });
  if (login.status !== 200) throw new Error(`login ${PHONE} → ${login.status} (dev OTP only works outside production)`);
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const me = await login.json();
  const orgId = me.user?.orgs?.[0]?.id;
  if (!orgId) throw new Error('CRM user has no organization');

  const list = await (await fetch(`${BASE}/v1/listings?limit=100`)).json();
  const scored = [];
  for (const item of list.items ?? []) {
    if (scored.length >= 20) break;
    if (item.locationScore == null) continue; // already computed → GET never triggers an AI call
    const r = await fetch(`${BASE}/v1/v2/listings/${item.id}/score`);
    if (r.status === 200) scored.push(item.id);
    await r.arrayBuffer();
  }
  // warm caches once (a cold burst measures the thundering herd, not steady state)
  for (const [url, headers] of [[`${BASE}/v1/billing/plans`, {}], [`${BASE}/v1/public/districts`, { 'x-api-key': API_KEY }], [`${BASE}/v1/crm/deals?limit=50`, { cookie, 'x-org-id': orgId }]]) {
    await (await fetch(url, { headers })).arrayBuffer();
  }
  return { cookie, orgId, scored };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function client(ctx, until) {
  const plan = ['billing.plans', 'crm.deals', 'crm.deals', 'v2.score', 'public.districts'];
  let i = Math.floor(Math.random() * plan.length);
  while (Date.now() < until) {
    const name = plan[i++ % plan.length];
    if (name === 'billing.plans') await timed(name, `${BASE}/v1/billing/plans`);
    else if (name === 'crm.deals') await timed(name, `${BASE}/v1/crm/deals?limit=50`, { headers: { cookie: ctx.cookie, 'x-org-id': ctx.orgId } });
    else if (name === 'v2.score' && ctx.scored.length) await timed(name, `${BASE}/v1/v2/listings/${pick(ctx.scored)}/score`);
    else if (name === 'public.districts') await timed(name, `${BASE}/v1/public/districts`, { headers: { 'x-api-key': API_KEY } });
  }
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : NaN);

const ctx = await setup();
console.log(`load: ${BASE} · ${CONCURRENCY} clients · ${DURATION_S}s · ${ctx.scored.length} scored listings`);
const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, () => client(ctx, started + DURATION_S * 1000)));
const elapsed = (Date.now() - started) / 1000;

let failed = false;
console.log('\n| endpoint | requests | req/s | p50 | p95 | p99 | errors | 429 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [name, s] of [...stats.entries()].sort()) {
  const lat = s.lat.sort((a, b) => a - b);
  const total = s.ok + s.err + s.limited;
  const p95 = pct(lat, 95);
  const errRate = total ? s.err / total : 0;
  if (p95 > P95_MS || errRate > 0.01) failed = true;
  console.log(`| ${name} | ${total} | ${(total / elapsed).toFixed(1)} | ${pct(lat, 50).toFixed(0)} ms | ${p95.toFixed(0)} ms | ${pct(lat, 99).toFixed(0)} ms | ${s.err} | ${s.limited} |`);
}
console.log(failed ? `\nFAIL: p95 ≥ ${P95_MS} ms or error rate ≥ 1 %` : '\nOK: thresholds met');
process.exit(failed ? 1 : 0);
