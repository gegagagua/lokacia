import { createHash, randomBytes } from 'node:crypto';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Tx } from '../client';
import * as s from '../schema/index';
import { newId } from '../schema/_common';
import type { Rng } from './content';

const DAY = 86_400_000;

async function insertMany<T extends PgTable>(tx: Tx, table: T, rows: T['$inferInsert'][], chunk = 1000) {
  for (let i = 0; i < rows.length; i += chunk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.insert(table).values(rows.slice(i, i + chunk) as any);
  }
}

/** Plans from PRODUCT.md monetization table. Prices editable in admin. */
export const PLAN_SEED: (typeof s.plans.$inferInsert)[] = [
  { key: 'vip_7', nameKa: 'VIP განცხადება — 7 დღე', audience: 'listing', kind: 'one_time', priceMinor: 1500, days: 7, features: ['სიის სათავეში', 'ყვითელი VIP ნიშანი'], sort: 1 },
  { key: 'vip_30', nameKa: 'VIP განცხადება — 30 დღე', audience: 'listing', kind: 'one_time', priceMinor: 4000, days: 30, features: ['სიის სათავეში 30 დღე', 'ყვითელი VIP ნიშანი'], sort: 2 },
  { key: 'owner', nameKa: 'მესაკუთრის პაკეტი', audience: 'user', kind: 'subscription', priceMinor: 4900, days: 30, features: ['5 განცხადება', 'სტატისტიკა და რჩევები'], limits: { listings: 5 }, sort: 3 },
  { key: 'broker', nameKa: 'ბროკერის CRM', audience: 'agent', kind: 'subscription', priceMinor: 5900, days: 30, features: ['CRM 1 აგენტისთვის', 'კლიენტების ბაზა', 'კანბანი'], sort: 4 },
  { key: 'broker_pro', nameKa: 'ბროკერის CRM Pro', audience: 'agent', kind: 'subscription', priceMinor: 9900, days: 30, features: ['ყველაფერი CRM-დან', 'ავტომატიზაცია', 'AI აღწერები'], sort: 5 },
  { key: 'agency', nameKa: 'აგენტურის პაკეტი', audience: 'org', kind: 'subscription', priceMinor: 29000, days: 30, features: ['გუნდი', 'ლიდების ავტოდისტრიბუცია', 'XML ფიდები', 'KPI'], limits: { seats: 5 }, sort: 6 },
  { key: 'developer', nameKa: 'დეველოპერის პაკეტი', audience: 'developer', kind: 'subscription', priceMinor: 49000, days: 30, features: ['პროექტის ლენდინგი', 'off-plan ფართები', 'წინასწარი ჯავშნები'], sort: 7 },
  { key: 'report_basic', nameKa: 'ლოკაციის რეპორტი', audience: 'report', kind: 'one_time', priceMinor: 9900, features: ['რაიონის ფასები', 'ვაკანსიები', 'კონკურენტები'], sort: 8 },
  { key: 'report_pro', nameKa: 'ლოკაციის რეპორტი Pro', audience: 'report', kind: 'one_time', priceMinor: 29900, features: ['ყველაფერი + ფეხით მოსიარულეთა ნაკადი', 'ლოკაციის ქულა', 'PDF'], sort: 9 },
  { key: 'transfer_listing', nameKa: 'ბიზნესის გადაცემის განცხადება', audience: 'listing', kind: 'one_time', priceMinor: 9900, days: 60, features: ['ბიზნესის გადაცემის ფორმატი'], sort: 10 },
  { key: 'api_basic', nameKa: 'ანალიტიკის API — Basic', audience: 'api', kind: 'subscription', priceMinor: 49000, days: 30, features: ['10 000 მოთხოვნა/თვე'], limits: { monthlyQuota: 10000, perMin: 60 }, sort: 11 },
  { key: 'api_pro', nameKa: 'ანალიტიკის API — Pro', audience: 'api', kind: 'subscription', priceMinor: 149000, days: 30, features: ['100 000 მოთხოვნა/თვე', 'ფეხით ნაკადი'], limits: { monthlyQuota: 100000, perMin: 300 }, sort: 12 },
];

type Ctx = {
  R: Rng;
  orgs: { id: string; slug: string; type: string }[];
  users: (typeof s.users.$inferInsert)[];
  listings: (typeof s.listings.$inferInsert)[];
  districts: { id: string; slug: string; city: string }[];
  demoOwner: { id?: string };
  demoTenant: { id?: string };
  target2: typeof s.listings.$inferInsert;
  providers: { id: string }[];
  pois: (typeof s.pois.$inferInsert)[];
  NOW: Date;
};

export async function seedBilling(tx: Tx, c: Ctx) {
  const { R, orgs, listings, districts, demoOwner, demoTenant, NOW, target2 } = c;
  const at = (days: number) => new Date(NOW.getTime() + days * DAY);
  await insertMany(tx, s.plans, PLAN_SEED);

  const subs: (typeof s.subscriptions.$inferInsert)[] = [
    { orgId: orgs[0]!.id, planKey: 'agency', status: 'active', seats: 5, periodStart: at(-12), periodEnd: at(18) },
    { orgId: orgs[1]!.id, planKey: 'agency', status: 'past_due', seats: 3, periodStart: at(-33), periodEnd: at(-3), graceUntil: at(4), failedAttempts: 2 },
    { orgId: orgs[2]!.id, planKey: 'broker', status: 'active', periodStart: at(-5), periodEnd: at(25) },
    { orgId: orgs[3]!.id, planKey: 'developer', status: 'active', periodStart: at(-20), periodEnd: at(10) },
    { userId: demoOwner.id!, planKey: 'owner', status: 'active', periodStart: at(-8), periodEnd: at(22) },
  ];
  await insertMany(tx, s.subscriptions, subs);

  const invoices: (typeof s.invoices.$inferInsert)[] = [];
  const payments: (typeof s.payments.$inferInsert)[] = [];
  let seq = 1000;
  for (let m = 0; m < 6; m++) {
    for (const [orgId, amount, plan] of [
      [orgs[0]!.id, 145000, 'agency'],
      [orgs[2]!.id, 5900, 'broker'],
      [orgs[3]!.id, 49000, 'developer'],
    ] as const) {
      const id = newId();
      const paid = m > 0 || orgId !== orgs[0]!.id;
      invoices.push({ id, number: `LK-2026-${seq++}`, orgId, purpose: 'subscription', lines: [{ name: plan, qty: 1, amountMinor: amount }], amountMinor: amount, status: paid ? 'paid' : 'open', dueAt: at(-30 * m), paidAt: paid ? at(-30 * m + 1) : null, createdAt: at(-30 * m - 2) });
      if (paid) payments.push({ invoiceId: id, amountMinor: amount, provider: R.pick(['bog', 'tbc', 'mock']), providerRef: `demo-${seq}`, idempotencyKey: `seed-${id}`, status: 'succeeded', attempts: 1, createdAt: at(-30 * m + 1) });
    }
  }
  const vipListings = listings.filter((l) => l.vipUntil);
  for (const l of vipListings.slice(0, 12)) {
    const id = newId();
    invoices.push({ id, number: `LK-2026-${seq++}`, userId: l.ownerId, purpose: 'vip', refId: l.id!, lines: [{ name: 'VIP 30 დღე', qty: 1, amountMinor: 4000 }], amountMinor: 4000, status: 'paid', paidAt: at(-R.int(1, 20)) });
    payments.push({ invoiceId: id, amountMinor: 4000, provider: 'mock', providerRef: `vip-${seq}`, idempotencyKey: `seed-${id}`, status: 'succeeded', attempts: 1 });
  }
  const failed = newId();
  invoices.push({ id: failed, number: `LK-2026-${seq++}`, orgId: orgs[1]!.id, purpose: 'subscription', lines: [{ name: 'agency', qty: 3, amountMinor: 87000 }], amountMinor: 87000, status: 'failed', dueAt: at(-3) });
  payments.push({ invoiceId: failed, amountMinor: 87000, provider: 'tbc', providerRef: 'demo-failed', idempotencyKey: `seed-${failed}`, status: 'failed', attempts: 2 });
  await insertMany(tx, s.invoices, invoices);
  await insertMany(tx, s.payments, payments);

  const vake = districts.find((d) => d.slug === 'vake')!;
  await insertMany(tx, s.reportPurchases, [
    { userId: demoTenant.id!, districtId: vake.id, businessType: 'cafe', productKey: 'report_basic', status: 'ready', payload: { generatedAt: at(-3).toISOString() } },
  ]);

  /* ---------- v2: traffic, scores ---------- */
  const active = listings.filter((l) => l.status === 'active' && l.city === 'tbilisi');
  const traffic: (typeof s.trafficSamples.$inferInsert)[] = [];
  const scores: (typeof s.locationScores.$inferInsert)[] = [];
  const hourly = [2, 1, 1, 1, 2, 4, 10, 25, 45, 50, 48, 55, 70, 65, 55, 52, 58, 72, 80, 70, 50, 32, 16, 6];
  for (const l of active.slice(0, 260)) {
    const base = R.float(0.4, 2.2);
    for (let wd = 0; wd < 7; wd++) {
      const weekend = wd === 0 || wd === 6 ? R.float(0.7, 1.3) : 1;
      for (let h = 0; h < 24; h++) traffic.push({ listingId: l.id!, provider: 'mock', weekday: wd, hour: h, count: Math.round(hourly[h]! * base * weekend * R.float(0.85, 1.15) * 10), lat: l.lat, lng: l.lng });
    }
  }
  for (const l of active) {
    const bt = l.businessTypes![0]!;
    const comps = [
      { key: 'traffic', label: 'ფეხით მოსიარულეთა ნაკადი', value: R.int(30, 98), weight: 0.35 },
      { key: 'competition', label: 'კონკურენცია (ნაკლები — უკეთესი)', value: R.int(20, 95), weight: 0.2 },
      { key: 'price', label: 'ფასი რაიონის საშუალოსთან', value: R.int(25, 95), weight: 0.2 },
      { key: 'transport', label: 'ტრანსპორტის ხელმისაწვდომობა', value: R.int(30, 100), weight: 0.15 },
      { key: 'passport', label: 'ტექნიკური შესაბამისობა', value: R.int(40, 100), weight: 0.1 },
    ];
    const score = Math.round(comps.reduce((a, x) => a + x.value * x.weight, 0));
    scores.push({ listingId: l.id!, businessType: bt, score, components: comps, summary: score >= 70 ? 'ძლიერი ლოკაცია: მაღალი ნაკადი და კარგი ტრანსპორტი.' : score >= 50 ? 'საშუალო ლოკაცია: ფასი ადეკვატურია, ნაკადი ზომიერი.' : 'სუსტი ლოკაცია ამ ბიზნესისთვის: დაბალი ნაკადი ან მაღალი კონკურენცია.' });
  }
  await insertMany(tx, s.trafficSamples, traffic, 3000);
  await insertMany(tx, s.locationScores, scores);

  /* ---------- v2: escrow, leases, rent, maintenance ---------- */
  const acceptedOffer = await tx.query.offers.findFirst({ where: (o, { eq }) => eq(o.status, 'accepted') });
  if (acceptedOffer) {
    await insertMany(tx, s.escrowAccounts, [
      { offerId: acceptedOffer.id, listingId: acceptedOffer.listingId, tenantId: acceptedOffer.fromUserId, ownerId: acceptedOffer.toUserId, amountMinor: acceptedOffer.priceMinor * 2, status: 'funded', provider: 'mock', providerRef: 'escrow-demo-1', history: [{ from: 'pending', to: 'funded', at: at(-9).toISOString() }] },
    ]);
    const tx1 = newId();
    await insertMany(tx, s.ledgerEntries, [
      { txId: tx1, account: 'escrow:held', debitMinor: acceptedOffer.priceMinor * 2, refType: 'escrow', memo: 'დეპოზიტის ჩარიცხვა' },
      { txId: tx1, account: 'psp:clearing', creditMinor: acceptedOffer.priceMinor * 2, refType: 'escrow', memo: 'დეპოზიტის ჩარიცხვა' },
    ]);
  }
  const leaseId = newId();
  const lease2 = newId();
  await insertMany(tx, s.leases, [
    { id: leaseId, listingId: target2.id!, ownerId: demoOwner.id!, tenantId: demoTenant.id!, tenantName: 'შპს „ყავის რუქა“', tenantPhone: '+995500000006', rentMinor: target2.priceMinor!, dayOfMonth: 5, startsOn: at(-120).toISOString().slice(0, 10), endsOn: at(610).toISOString().slice(0, 10), autopay: true },
    { id: lease2, listingId: listings.find((l) => l.ownerId === demoOwner.id && l.status === 'rented')?.id ?? target2.id!, ownerId: demoOwner.id!, tenantName: 'ი/მ ნათია ხარაიშვილი', tenantPhone: '+995599001122', rentMinor: 180000, dayOfMonth: 1, startsOn: at(-400).toISOString().slice(0, 10), autopay: false },
  ]);
  const rent: (typeof s.rentInvoices.$inferInsert)[] = [];
  for (let m = 0; m < 4; m++) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - m, 5);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    rent.push({ leaseId, period, amountMinor: target2.priceMinor!, dueOn: d.toISOString().slice(0, 10), status: m === 0 ? 'open' : 'paid', paidAt: m === 0 ? null : new Date(d.getTime() + DAY) });
    const d2 = new Date(NOW.getFullYear(), NOW.getMonth() - m, 1);
    rent.push({ leaseId: lease2, period, amountMinor: 180000, penaltyMinor: m === 1 ? 5400 : 0, dueOn: d2.toISOString().slice(0, 10), status: m <= 1 ? 'overdue' : 'paid', paidAt: m <= 1 ? null : new Date(d2.getTime() + 3 * DAY), lateNoticeSentAt: m <= 1 ? at(-2) : null });
  }
  await insertMany(tx, s.rentInvoices, rent);
  await insertMany(tx, s.maintenanceRequests, [
    { leaseId, reporterId: demoTenant.id!, title: 'გამწოვის ვენტილატორი ხმაურობს', description: 'მოტორი ხმაურობს ჩართვისას, 2 დღეია.', priority: 'normal', status: 'in_progress', photos: ['/api/v1/media/placeholder/detail/maint-1.svg'] },
    { leaseId, reporterId: demoTenant.id!, title: 'წყლის ჟონვა ჭერიდან', priority: 'urgent', status: 'open' },
    { leaseId: lease2, title: 'შესასვლელი კარის საკეტი', priority: 'low', status: 'resolved', resolvedAt: at(-20) },
  ]);
  await insertMany(tx, s.utilityReadings, [0, 1, 2].flatMap((m) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - m, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return [
      { leaseId, kind: 'electricity' as const, period, reading: 12000 + m * 800, amountMinor: R.int(250, 420) * 100 },
      { leaseId, kind: 'water' as const, period, reading: 900 + m * 40, amountMinor: R.int(30, 60) * 100 },
      { leaseId, kind: 'gas' as const, period, amountMinor: R.int(80, 200) * 100 },
    ];
  }));

  await insertMany(tx, s.scans, [
    { listingId: target2.id!, uploadedBy: demoOwner.id!, format: 'glb', url: '/api/v1/media/demo/room.glb', status: 'ready', plan: { outline: [[0, 0], [9.2, 0], [9.2, 6.5], [5.1, 6.5], [5.1, 8.4], [0, 8.4]], widthM: 9.2, depthM: 8.4, areaM2: 69.3 } },
  ]);

  /* ---------- v2: API keys, finance marketplace, fx ---------- */
  const rawKey = 'lk_demo_analytics_key_123456';
  await insertMany(tx, s.apiKeys, [
    { orgId: orgs[1]!.id, userId: c.users.find((u) => u.phone === '+995500000010')!.id!, name: 'ბანკის ანალიტიკა', prefix: rawKey.slice(0, 10), keyHash: createHash('sha256').update(rawKey).digest('hex'), scopes: ['districts:read', 'prices:read', 'traffic:read', 'scores:read'], planKey: 'api_pro', rateLimitPerMin: 300, monthlyQuota: 100000, lastUsedAt: at(-1) },
  ]);
  const keyRow = await tx.query.apiKeys.findFirst();
  if (keyRow) {
    const usage: (typeof s.apiUsage.$inferInsert)[] = [];
    for (let d = 0; d < 20; d++) for (const ep of ['/v1/public/districts', '/v1/public/price-index', '/v1/public/scores']) usage.push({ apiKeyId: keyRow.id, day: at(-d).toISOString().slice(0, 10), endpoint: ep, count: R.int(20, 400) });
    await insertMany(tx, s.apiUsage, usage);
  }

  const products = [
    { id: newId(), partner: 'დემო ბანკი A', kind: 'fitout_loan' as const, name: 'მოწყობის სესხი მცირე ბიზნესისთვის', description: 'სესხი ფართის რემონტისთვის და აღჭურვილობისთვის, 6 თვის საშეღავათო პერიოდით.', rateText: 'წლიური 14%-დან', minAmountMinor: 500000, maxAmountMinor: 25000000, commissionPct: 1.5 },
    { id: newId(), partner: 'დემო ლიზინგი', kind: 'leasing' as const, name: 'აღჭურვილობის ლიზინგი', description: 'სამზარეულოს, ბარის და საწარმოო აღჭურვილობის ლიზინგი 36 თვემდე.', rateText: 'თვიური 1.1%-დან', minAmountMinor: 300000, maxAmountMinor: 15000000, commissionPct: 2 },
    { id: newId(), partner: 'დემო დაზღვევა', kind: 'insurance' as const, name: 'ბიზნეს-ქონების დაზღვევა', description: 'ხანძარი, დატბორვა, ქურდობა, მესამე პირის პასუხისმგებლობა.', rateText: 'წლიური 0.3%-დან', commissionPct: 12 },
  ];
  await insertMany(tx, s.financeProducts, products);
  await insertMany(tx, s.financeApplications, [
    { productId: products[0]!.id, userId: demoTenant.id!, listingId: target2.id!, amountMinor: 4000000, termMonths: 36, consentAt: at(-6), status: 'approved', partnerRef: 'bank-demo-771', commissionMinor: 60000 },
    { productId: products[1]!.id, userId: demoTenant.id!, amountMinor: 1200000, termMonths: 24, consentAt: at(-2), status: 'sent', partnerRef: 'lease-demo-12' },
  ]);

  await insertMany(tx, s.fxRates, [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
    { currency: 'USD', day: at(-d).toISOString().slice(0, 10), rateX10000: 27000 + R.int(-120, 120) },
    { currency: 'EUR', day: at(-d).toISOString().slice(0, 10), rateX10000: 29400 + R.int(-150, 150) },
  ]));

  await insertMany(tx, s.prebookings, listings.filter((l) => l.projectId).slice(0, 4).map((l, k) => ({ listingId: l.id!, projectId: l.projectId, userId: demoTenant.id!, message: 'გვინდა ჯავშნა კომპლექსის ექსპლუატაციაში შესვლისას.', phone: '+995500000006', status: k === 0 ? ('contacted' as const) : ('requested' as const) })));

  // audit trail sample
  await insertMany(tx, s.auditLog, [
    { actorId: c.users[1]!.id!, action: 'listing.approve', entity: 'listing', entityId: listings[0]!.id!, diff: { status: ['pending_review', 'active'] }, ip: '127.0.0.1' },
    { actorId: c.users[0]!.id!, action: 'settings.update', entity: 'settings', entityId: 'launch_promo_until', diff: { value: ['2026-10-01', 'promo'] }, ip: '127.0.0.1' },
  ]);
  void randomBytes;
}
