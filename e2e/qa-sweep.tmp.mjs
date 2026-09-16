import { chromium, request } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.env.QA_OUT;
const ids = Object.fromEntries(fs.readFileSync(process.env.QA_IDS, 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
const W = 'http://localhost:3100', C = 'http://localhost:3101', A = 'http://localhost:3102';
const runs = [
  { role: null, base: W, paths: ['/', '/search', '/search?businessType=cafe&districts=vake', `/listings/${ids.listing}`, '/map', '/map?metric=traffic', '/demand', `/demand/${ids.demand}`, '/services', '/services/motsqoba-plus', '/projects', '/projects/kvartali-vake-park', `/broker/${ids.broker}`, '/agency/city-spaces', '/brokers', '/cafe', '/cafe/vake', '/districts/vake', '/pages/about', '/compare/demo-compare-cafe', '/pricing', '/reports', '/api-access', '/finance', '/login', `/confirm/${ids.liveness}`, `/alerts/unsubscribe/${ids.saved}`, '/does-not-exist'] },
  { role: '+995500000003', base: W, paths: ['/account', '/account/profile', '/account/listings', '/account/listings/new', `/account/listings/${ids.ownerListingId}/edit`, `/account/listings/${ids.ownerListingId}/stats`, '/account/offers', `/account/offers/${ids.offer}`, '/account/viewings', '/account/messages', '/account/org', '/account/billing', '/account/property', `/account/property/leases/${ids.lease}`, '/account/favorites', '/account/saved-searches', '/account/services', '/account/demand'] },
  { role: '+995500000006', base: W, paths: [`/listings/${ids.listing}/book`, `/listings/${ids.listing}/offer`, '/account/favorites', '/account/offers', '/account/messages', `/checkout/mock/${ids.payment}`] },
  { role: '+995500000004', base: C, paths: ['/dashboard', '/contacts', `/contacts/${ids.contact}`, '/contacts/duplicates', '/deals', `/deals/${ids.deal}`, '/calendar', '/tasks', '/inbox', '/listings', `/listings/${ids.crmListing}`, '/listings/new', '/presentations', '/sequences', '/liveness', '/competitors', '/owner-reports', '/cobroker', '/analytics', '/sources', '/documents', '/team', '/data', '/audit', '/settings', '/settings/pipeline', '/settings/organization', '/settings/profile'] },
  { role: null, base: C, paths: ['/portal/demo-client-portal', '/p/demo-presentation', `/sign/${ids.sign}`, '/login'] },
  { role: '+995500000001', base: A, paths: ['/', '/moderation', `/moderation/${ids.pendingListing}`, '/verifications', '/users', `/users/${ids.userId}`, '/orgs', `/orgs/${ids.orgId}`, '/settings', '/cms', `/cms/${ids.cmsId}`, '/taxonomy', `/taxonomy/${ids.btId}`, '/audit', '/feedback', '/revenue', '/escrow', '/finance'] },
];
const browser = await chromium.launch();
const results = [];
for (const run of runs) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  if (run.role) {
    const r = await ctx.request.post(`${W}/api/v1/auth/otp/verify`, { data: { phone: run.role, code: '123456' } });
    if (!r.ok()) { console.log('LOGIN FAIL', run.role, r.status()); continue; }
  }
  for (const path of run.paths) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*404|hydrat.*cz-shortcut|Download the React DevTools/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
    let status = 0;
    try {
      const res = await page.goto(run.base + path, { waitUntil: 'load', timeout: 60000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(2500);
    } catch (e) { errors.push('goto: ' + e.message.slice(0, 120)); }
    const info = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.title, h1: document.querySelector('h1')?.textContent?.slice(0, 60) ?? '', url: location.pathname, notFound: /ვერ მოიძებნა|404/.test(document.body.innerText.slice(0, 400)) })).catch(() => ({}));
    const name = (run.base.slice(-4) + path).replace(/[^a-z0-9]+/gi, '_').slice(0, 90);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});
    results.push({ app: run.base.slice(-4), role: run.role?.slice(-2) ?? '-', path, status, ...info, errors });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
for (const r of results) {
  const bad = r.status >= 400 || r.errors.length || r.overflow > 0 || (r.url && r.url !== r.path.split('?')[0] && !r.path.includes('?token'));
  if (bad) console.log(`${r.app} ${r.role} ${r.path} -> ${r.status} url=${r.url} ovf=${r.overflow} h1=${r.h1}\n   ${r.errors.slice(0, 3).join('\n   ')}`);
}
console.log('checked', results.length, 'pages');
