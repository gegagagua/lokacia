import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, availabilitySlots, eq, listingEvents, listings, livenessChecks, notifications, offers, transferEquipment } from '@lokacia/db';
import { createApp, loginAs, PHONES } from './helpers';
import { LivenessService } from '../src/modules/liveness/liveness.service';
import { ViewingsService } from '../src/modules/viewings/viewings.service';
import { StatsService, tbilisiDay } from '../src/modules/stats/stats.service';

type Ctx = Awaited<ReturnType<typeof createApp>>;
const HOUR = 3600_000;

const baseListing = {
  businessTypes: ['office'],
  dealType: 'rent',
  title: 'ტესტ ოფისი ვაკეში ჩვენებებისთვის',
  description: 'ტესტ აღწერა',
  address: 'თბილისი, ჭავჭავაძის პრ. 10',
  lat: 41.7085,
  lng: 44.752,
  areaM2: 80,
  priceMinor: 400000,
  passport: { ceilingM: 3.2, widthM: 8, depthM: 10, powerKw: 15 },
};

/** Creates a listing as the demo owner and approves it as moderator. */
async function activeListing(ctx: Ctx, extra: Record<string, unknown> = {}) {
  const owner = await loginAs(ctx.app, PHONES.owner);
  const created = await owner.post('/v1/listings').send({ ...baseListing, ...extra, submit: true });
  expect(created.status).toBe(201);
  const mod = await loginAs(ctx.app, PHONES.moderator);
  const approved = await mod.post(`/v1/listings/${created.body.id}/status`).send({ status: 'active' });
  expect(approved.status).toBe(200);
  await ctx.queue.drain();
  return { owner, listing: approved.body as { id: string; slug: string; title: string } };
}

describe('Phase 7 done-when: viewing → chat → offer → counter → accept → contract PDF', () => {
  let ctx: Ctx;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('walks the whole transaction flow', async () => {
    const { owner, listing } = await activeListing(ctx);
    const tenant = await loginAs(ctx.app, PHONES.tenant);

    // owner defines viewing slots (P15)
    const start = new Date(Date.now() + 3 * 24 * HOUR);
    start.setUTCMinutes(0, 0, 0);
    const slots = await owner.post(`/v1/listings/${listing.id}/slots`).send({
      kind: 'viewing',
      slots: [0, 1].map((i) => ({ startsAt: new Date(start.getTime() + i * HOUR).toISOString(), endsAt: new Date(start.getTime() + i * HOUR + 30 * 60_000).toISOString() })),
    });
    expect(slots.status).toBe(201);
    const [slotA, slotB] = slots.body as { id: string }[];

    // tenant books a video viewing
    const booked = await tenant.post('/v1/viewings').send({ listingId: listing.id, slotId: slotA!.id, mode: 'video', note: 'მოვალ პარტნიორთან' });
    expect(booked.status).toBe(201);
    expect(booked.body.status).toBe('confirmed');
    expect(booked.body.videoUrl).toMatch(/^https:\/\/meet\.jit\.si\//);
    expect(booked.body.host.phone).toMatch(/^\+995/);
    // slot is taken now
    const taken = await loginAs(ctx.app, PHONES.developer);
    expect((await taken.post('/v1/viewings').send({ listingId: listing.id, slotId: slotA!.id })).status).toBe(409);
    const publicSlots = await ctx.http().get(`/v1/listings/${listing.id}/slots?kind=viewing`);
    expect(publicSlots.body.find((s: { id: string }) => s.id === slotA!.id).booked).toBe(true);
    // ICS invitation
    const ics = await tenant.get(`/v1/viewings/${booked.body.id}/ics`);
    expect(ics.status).toBe(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.text).toContain('BEGIN:VEVENT');
    // both sides see it
    const hostList = await owner.get('/v1/viewings?role=host&status=upcoming');
    expect(hostList.body.map((v: { id: string }) => v.id)).toContain(booked.body.id);
    expect(hostList.body.find((v: { id: string }) => v.id === booked.body.id).visitor.phone).toBe(PHONES.tenant);
    // reschedule to slot B frees slot A
    const moved = await tenant.post(`/v1/viewings/${booked.body.id}/reschedule`).send({ slotId: slotB!.id });
    expect(moved.status).toBe(200);
    expect(moved.body.slotId).toBe(slotB!.id);
    const [freed] = await ctx.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slotA!.id));
    expect(freed!.bookedById).toBeNull();

    // chat about the listing
    const started = await tenant.post('/v1/conversations').send({ listingId: listing.id, body: 'გამარჯობა! ფართი ისევ თავისუფალია?' });
    expect(started.status).toBe(201);
    const convId = started.body.conversationId as string;
    const ownerConvs = await owner.get('/v1/conversations');
    expect(ownerConvs.body.find((c: { id: string }) => c.id === convId).unread).toBe(1);
    const unread = await owner.get('/v1/conversations/unread');
    expect(unread.body.count).toBeGreaterThanOrEqual(1);
    const reply = await owner.post(`/v1/conversations/${convId}/messages`).send({ body: 'კი, ჩვენებაზე გაჩვენებთ.', attachments: [{ url: '/api/v1/media/files/x.pdf', name: 'ნახაზი.pdf', type: 'application/pdf' }] });
    expect(reply.status).toBe(201);
    await owner.post(`/v1/conversations/${convId}/read`).expect(200);
    const msgs = await tenant.get(`/v1/conversations/${convId}/messages?limit=1`);
    expect(msgs.body.items).toHaveLength(1);
    expect(msgs.body.items[0].attachments[0].name).toBe('ნახაზი.pdf');
    expect(msgs.body.nextCursor).toBeTruthy();
    const older = await tenant.get(`/v1/conversations/${convId}/messages?limit=10&cursor=${msgs.body.nextCursor}`);
    expect(older.body.items[0].readAt).toBeTruthy(); // read receipt on tenant's first message
    // outsiders cannot read the conversation
    expect((await taken.get(`/v1/conversations/${convId}/messages`)).status).toBe(404);

    // offer with inline tenant profile (P16, P20)
    const offer = await tenant.post('/v1/offers').send({
      listingId: listing.id, priceMinor: 350000, termMonths: 36, freeMonths: 3, indexationPct: 0, fitoutPaidBy: 'owner', message: '3 წლით',
      tenantProfile: { activity: 'სპეშელთი ყავა', companyName: 'ყავის სახელოსნო', experienceYears: 5, desiredTermMonths: 36 },
    });
    expect(offer.status).toBe(201);
    expect(offer.body.rootOfferId).toBe(offer.body.id);
    expect((await tenant.post('/v1/offers').send({ listingId: listing.id, priceMinor: 1, termMonths: 1 })).status).toBe(409);
    const received = await owner.get('/v1/offers?box=received');
    const summary = received.body.find((t: { rootId: string }) => t.rootId === offer.body.id);
    expect(summary.actionRequired).toBe(true);
    // owner sees who the tenant is
    const profile = await owner.get(`/v1/users/${tenant.user.id}/tenant-profile`);
    expect(profile.status).toBe(200);
    expect(profile.body.profile.companyName).toBe('ყავის სახელოსნო');
    // tenant cannot accept own offer
    expect((await tenant.post(`/v1/offers/${offer.body.id}/accept`)).status).toBe(403);

    // owner counters
    const counter = await owner.post(`/v1/offers/${offer.body.id}/counter`).send({ priceMinor: 380000, termMonths: 36, freeMonths: 2, indexationPct: 3, fitoutPaidBy: 'tenant', message: '2 უფასო თვე' });
    expect(counter.status).toBe(201);
    expect(counter.body.parentOfferId).toBe(offer.body.id);
    expect(counter.body.rootOfferId).toBe(offer.body.id);
    const thread = await tenant.get(`/v1/offers/${counter.body.id}`);
    expect(thread.body.offers.map((o: { status: string }) => o.status)).toEqual(['countered', 'pending']);
    expect(thread.body.can).toMatchObject({ accept: true, counter: true, withdraw: false });
    const tenantNotes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, tenant.user.id), eq(notifications.template, 'offer_countered')));
    expect(tenantNotes.length).toBeGreaterThan(0);

    // tenant accepts → contract PDF generated (P17)
    const accepted = await tenant.post(`/v1/offers/${counter.body.id}/accept`);
    expect(accepted.status).toBe(200);
    await ctx.queue.drain();
    const [row] = await ctx.db.select().from(offers).where(eq(offers.id, counter.body.id));
    expect(row!.status).toBe('accepted');
    expect(row!.contractUrl).toMatch(/^\/api\/v1\/offers\/.+\/contract/);
    const pdf = await owner.get(`/v1/offers/${counter.body.id}/contract`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await taken.get(`/v1/offers/${counter.body.id}/contract`)).status).toBe(404);
    const final = await owner.get(`/v1/offers/${offer.body.id}`);
    expect(final.body.status).toBe('accepted');
    expect(final.body.contractUrl).toBeTruthy();
  });

  it('business transfer: equipment included in offer and contract (P11)', async () => {
    const { owner, listing } = await activeListing(ctx, {
      businessTypes: ['cafe'],
      dealType: 'transfer',
      title: 'მოქმედი კაფე აღჭურვილობით — გადაცემა',
      priceMinor: 9_000_000,
      passport: { powerKw: 25, ceilingM: 3.4, hasHood: true, hasGas: true, wetPoints: 2 },
      equipment: [{ name: 'ესპრესო-აპარატი', qty: 1, priceMinor: 1_200_000 }, { name: 'მაცივარი', qty: 2, priceMinor: 300_000 }],
    });
    const eq2 = await ctx.db.select().from(transferEquipment).where(eq(transferEquipment.listingId, listing.id));
    expect(eq2).toHaveLength(2);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const offer = await tenant.post('/v1/offers').send({ listingId: listing.id, priceMinor: 8_500_000, termMonths: 1, equipmentIncluded: true });
    expect(offer.status).toBe(201);
    expect(offer.body.equipmentIncluded).toBe(true);
    const thread = await owner.get(`/v1/offers/${offer.body.id}`);
    expect(thread.body.listing.equipment).toHaveLength(2);
    expect((await owner.post(`/v1/offers/${offer.body.id}/accept`)).status).toBe(200);
    await ctx.queue.drain();
    const pdf = await tenant.get(`/v1/offers/${offer.body.id}/contract`);
    expect(pdf.status).toBe(200);
  });

  it('withdraw and reject rules', async () => {
    const { owner, listing } = await activeListing(ctx);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const offer = await tenant.post('/v1/offers').send({ listingId: listing.id, priceMinor: 300000, termMonths: 12 });
    expect((await owner.post(`/v1/offers/${offer.body.id}/withdraw`)).status).toBe(403);
    expect((await tenant.post(`/v1/offers/${offer.body.id}/withdraw`)).body.status).toBe('withdrawn');
    const again = await tenant.post('/v1/offers').send({ listingId: listing.id, priceMinor: 310000, termMonths: 12 });
    expect(again.status).toBe(201);
    const rej = await owner.post(`/v1/offers/${again.body.id}/reject`).send({ reason: 'ფასი დაბალია' });
    expect(rej.body.status).toBe('rejected');
    expect((await owner.post(`/v1/offers/${again.body.id}/counter`).send({ priceMinor: 1, termMonths: 1 })).status).toBe(422);
    // cannot offer on own listing
    expect((await owner.post('/v1/offers').send({ listingId: listing.id, priceMinor: 1, termMonths: 1 })).status).toBe(400);
  });
});

describe('viewings: cancel, requests, reminders, short-term (P15, P21)', () => {
  let ctx: Ctx;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('cancel frees the slot; free-time request needs owner confirmation; reminder the day before', async () => {
    const { owner, listing } = await activeListing(ctx);
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const startsAt = new Date(Date.now() + 20 * HOUR);
    const slots = await owner.post(`/v1/listings/${listing.id}/slots`).send({ kind: 'viewing', slots: [{ startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString() }] });
    const v = await tenant.post('/v1/viewings').send({ listingId: listing.id, slotId: slots.body[0].id, mode: 'onsite' });
    expect(v.status).toBe(201);

    const svc = ctx.app.get(ViewingsService);
    const reminded = await svc.remindDue(new Date());
    expect(reminded).toBeGreaterThanOrEqual(1);
    const reminders = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, tenant.user.id), eq(notifications.template, 'viewing_reminder')));
    expect(reminders.length).toBeGreaterThan(0);
    const again = await svc.remindDue(new Date());
    const remindersAfter = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, tenant.user.id), eq(notifications.template, 'viewing_reminder')));
    expect(remindersAfter.length).toBe(reminders.length); // idempotent
    expect(again).toBe(0);

    const cancelled = await owner.post(`/v1/viewings/${v.body.id}/cancel`).send({ reason: 'ფართი დაკავებულია' });
    expect(cancelled.body.status).toBe('cancelled');
    const [slot] = await ctx.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slots.body[0].id));
    expect(slot!.bookedById).toBeNull();

    const req = await tenant.post('/v1/viewings').send({ listingId: listing.id, startsAt: new Date(Date.now() + 48 * HOUR).toISOString() });
    expect(req.body.status).toBe('requested');
    expect((await tenant.post(`/v1/viewings/${req.body.id}/confirm`)).status).toBe(403);
    expect((await owner.post(`/v1/viewings/${req.body.id}/confirm`)).body.status).toBe('confirmed');
  });

  it('short-term booking uses priced slots', async () => {
    const { owner, listing } = await activeListing(ctx, { dealType: 'short_term', priceHourMinor: 3000, priceDayMinor: 20000 });
    const s = new Date(Date.now() + 5 * 24 * HOUR);
    const slots = await owner.post(`/v1/listings/${listing.id}/slots`).send({ kind: 'short_term', slots: [{ startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 24 * HOUR).toISOString(), priceMinor: 20000 }] });
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const b = await tenant.post('/v1/viewings').send({ listingId: listing.id, slotId: slots.body[0].id });
    expect(b.status).toBe(201);
    expect(b.body.kind).toBe('short_term');
    expect(b.body.priceMinor).toBe(20000);
  });
});

describe('liveness (P4) with fake time', () => {
  let ctx: Ctx;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('sends one-tap link after the interval, hides after 72 h, confirm restores', async () => {
    const { owner, listing } = await activeListing(ctx);
    const svc = ctx.app.get(LivenessService);
    const only = { listingIds: [listing.id] }; // don't touch seeded listings shared with other test files
    const now = new Date();
    // just approved → not due
    await svc.sendDue(now, only);
    expect(await ctx.db.select().from(livenessChecks).where(eq(livenessChecks.listingId, listing.id))).toHaveLength(0);

    const later = new Date(now.getTime() + 13 * 24 * HOUR);
    await svc.sendDue(later, only);
    const checks = await ctx.db.select().from(livenessChecks).where(eq(livenessChecks.listingId, listing.id));
    expect(checks).toHaveLength(1);
    expect(checks[0]!.result).toBe('pending');
    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, owner.user.id), eq(notifications.template, 'liveness_request')));
    expect(notes.some((n) => n.link === `/confirm/${listing.id}?token=${checks[0]!.token}`)).toBe(true);
    expect(notes.some((n) => n.channel === 'sms')).toBe(true);
    // second run does not duplicate
    await svc.sendDue(new Date(later.getTime() + HOUR), only);
    expect(await ctx.db.select().from(livenessChecks).where(eq(livenessChecks.listingId, listing.id))).toHaveLength(1);

    // confirm page data
    const info = await ctx.http().get(`/v1/liveness/checks/${listing.id}?token=${checks[0]!.token}`);
    expect(info.status).toBe(200);
    expect(info.body.listing.title).toBe(listing.title);
    expect((await ctx.http().get(`/v1/liveness/checks/${listing.id}?token=wrong-token-123`)).status).toBe(410);

    // 71 h: still active; 73 h: stale
    await svc.expireDue(new Date(later.getTime() + 71 * HOUR), only);
    expect((await ctx.db.select().from(listings).where(eq(listings.id, listing.id)))[0]!.status).toBe('active');
    await svc.expireDue(new Date(later.getTime() + 73 * HOUR), only);
    const [stale] = await ctx.db.select().from(listings).where(eq(listings.id, listing.id));
    expect(stale!.status).toBe('stale');
    const hidden = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, owner.user.id), eq(notifications.template, 'liveness_hidden')));
    expect(hidden.length).toBeGreaterThan(0);
    await ctx.queue.drain();
    const search = await ctx.http().get('/v1/listings').query({ q: listing.title, limit: 50 });
    expect(search.body.items.map((i: { id: string }) => i.id)).not.toContain(listing.id);

    // one tap "still available" → active again
    const confirmed = await ctx.http().post(`/v1/listings/${listing.id}/confirm`).send({ token: checks[0]!.token, answer: 'available' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('active');
  });
});

describe('stats & advice (P19) + AI describe + account summary', () => {
  let ctx: Ctx;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('dashboard numbers equal ingested events (Phase 9 done-when); aggregation is idempotent', async () => {
    const { owner, listing } = await activeListing(ctx);
    const now = new Date();
    const at = (daysAgo: number, h = 0) => new Date(now.getTime() - daysAgo * 24 * HOUR - h * 60_000);
    const events = [
      ...Array.from({ length: 12 }, (_, i) => ({ type: 'view' as const, at: at(0, i) })),
      ...Array.from({ length: 7 }, (_, i) => ({ type: 'view' as const, at: at(1, i) })),
      ...Array.from({ length: 5 }, (_, i) => ({ type: 'view' as const, at: at(3, i) })),
      { type: 'reveal' as const, at: at(0, 1) },
      { type: 'reveal' as const, at: at(3, 1) },
      { type: 'save' as const, at: at(1, 2) },
      { type: 'share' as const, at: at(3, 3) },
    ];
    await ctx.db.insert(listingEvents).values(events.map((e) => ({ listingId: listing.id, type: e.type, at: e.at, ipHash: 'test' })));
    const stats = ctx.app.get(StatsService);
    const from = tbilisiDay(at(5));
    const to = tbilisiDay(now);
    await stats.aggregate(from, to);
    await stats.aggregate(from, to); // idempotent

    const d = await owner.get(`/v1/stats/listings/${listing.id}?days=7`);
    expect(d.status).toBe(200);
    expect(d.body.series).toHaveLength(7);
    expect(d.body.totals).toEqual({ views: 24, reveals: 2, saves: 1, shares: 1 });
    expect(d.body.series.at(-1).day).toBe(to);
    expect(d.body.series.at(-1).views).toBe(events.filter((e) => e.type === 'view' && tbilisiDay(e.at) === to).length);
    expect(d.body.advice.map((a: { key: string }) => a.key)).toEqual(expect.arrayContaining(['few_photos', 'no_floorplan']));
    expect(d.body.passportCompletenessPct).toBeGreaterThan(0);
    expect(d.body.districtAvg.listings).toBeGreaterThan(0);

    const explain = await owner.post(`/v1/stats/listings/${listing.id}/explain`);
    expect(explain.status).toBe(200);
    expect(explain.body.text.length).toBeGreaterThan(20);

    const tenant = await loginAs(ctx.app, PHONES.tenant);
    expect((await tenant.get(`/v1/stats/listings/${listing.id}`)).status).toBe(403);
  });

  it('price advice when price is far above the district average', async () => {
    const { owner, listing } = await activeListing(ctx, { priceMinor: 10_000_000 });
    const d = await owner.get(`/v1/stats/listings/${listing.id}?days=30`);
    expect(d.body.price?.verdict).toBe('above');
    expect(d.body.advice[0].key).toBe('price_high');
  });

  it('generates ka/en/ru descriptions from wizard facts (template fallback)', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const r = await owner.post('/v1/ai/describe').send({ facts: { title: 'კაფე', businessTypes: ['cafe'], dealType: 'rent', areaM2: 60, address: 'ჭავჭავაძის 1', lat: 41.7085, lng: 44.752, priceMinor: 300000, passport: { powerKw: 25, hasHood: true } } });
    expect(r.status).toBe(200);
    expect(r.body.source).toBe('template');
    expect(r.body.ka).toContain('60 მ²');
    expect(r.body.en).toContain('60 m²');
    expect(r.body.ru).toContain('60 м²');
  });

  it('account summary is role-aware', async () => {
    const owner = await loginAs(ctx.app, PHONES.owner);
    const s = await owner.get('/v1/stats/account');
    expect(s.status).toBe(200);
    expect(s.body.listings.total).toBeGreaterThan(0);
    expect(s.body.pending).toHaveProperty('unreadMessages');
    const tenant = await loginAs(ctx.app, PHONES.tenant);
    const t = await tenant.get('/v1/stats/account');
    expect(t.body.tenant).toHaveProperty('favorites');
    expect(t.body.pending.upcomingViewings.length).toBeGreaterThan(0);
  });
});
