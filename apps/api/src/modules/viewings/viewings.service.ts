import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, availabilitySlots, desc, eq, gte, inArray, isNull, listingMedia, listings, lte, sql, users, viewings } from '@lokacia/db';
import { formatDateTimeKa, formatMoney, type ViewingDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import type { AuthUser } from '../../common/request';
import { buildIcs } from '../../integrations/calendar/ics';
import { ListingReadService } from '../listings/listing-read.service';
import { NotificationsService } from '../notifications/notifications.service';
import { registerTemplates } from '../notifications/templates';

registerTemplates({
  viewing_booked: { title: (v) => (v.kind === 'short_term' ? 'ახალი ჯავშნა' : 'ჩვენება ჯავშნილია'), body: (v) => `„${v.title}“ — ${v.when}${v.mode ? `, ${v.mode}` : ''}${v.price ? `, ${v.price}` : ''}` },
  viewing_requested: { title: () => 'ჩვენების მოთხოვნა', body: (v) => `„${v.title}“ — ${v.when}. დაადასტურეთ ან შესთავაზეთ სხვა დრო.` },
  viewing_confirmed: { title: () => 'ჩვენება დადასტურდა', body: (v) => `„${v.title}“ — ${v.when}` },
  viewing_cancelled: { title: () => 'ჩვენება გაუქმდა', body: (v) => `„${v.title}“ — ${v.when}${v.reason ? `. მიზეზი: ${v.reason}` : ''}` },
  viewing_rescheduled: { title: () => 'ჩვენების დრო შეიცვალა', body: (v) => `„${v.title}“ — ახალი დრო: ${v.when}` },
  viewing_reminder: { title: () => 'ჩვენება ხვალ', body: (v) => `„${v.title}“ — ${v.when}${v.video ? `, ვიდეოზარის ბმული: ${v.video}` : ''}` },
});

type ViewingRow = typeof viewings.$inferSelect;
type ListingRow = typeof listings.$inferSelect;
const HOUR = 3600_000;
const tbilisiWhen = (d: Date) => formatDateTimeKa(new Date(d.getTime() + (4 * HOUR + d.getTimezoneOffset() * 60_000)));

/** P15 viewings + P21 short-term bookings on availability slots. */
@Injectable()
export class ViewingsService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register('viewings.remind', () => this.remindDue());
    this.queue.every('viewings.remind', HOUR);
  }

  private hostId(l: ListingRow) {
    return l.agentId ?? l.ownerId;
  }

  async book(user: AuthUser, input: { listingId: string; slotId?: string; startsAt?: string; mode: 'onsite' | 'video'; note?: string | null }) {
    const l = await this.read.findRaw(input.listingId);
    if (!l || !['active', 'stale'].includes(l.status)) throw problems.notFound('განცხადება');
    if (l.ownerId === user.id || l.agentId === user.id) throw problems.badRequest('საკუთარ ფართზე ჯავშნა შეუძლებელია');
    let startsAt: Date;
    let endsAt: Date;
    let slotId: string | null = null;
    let kind: 'viewing' | 'short_term' = 'viewing';
    let status: ViewingRow['status'] = 'confirmed';
    let priceMinor: number | null = null;
    if (input.slotId) {
      // atomic claim: only a free, future slot of this listing
      const [slot] = await this.dbs.db
        .update(availabilitySlots)
        .set({ bookedById: user.id, bookedAt: new Date() })
        .where(and(eq(availabilitySlots.id, input.slotId), eq(availabilitySlots.listingId, l.id), isNull(availabilitySlots.bookedById), isNull(availabilitySlots.deletedAt), gte(availabilitySlots.startsAt, new Date())))
        .returning();
      if (!slot) throw problems.conflict('ეს დრო უკვე დაკავებულია — აირჩიეთ სხვა');
      startsAt = slot.startsAt;
      endsAt = slot.endsAt;
      slotId = slot.id;
      kind = slot.kind;
      priceMinor = slot.priceMinor;
    } else if (input.startsAt) {
      startsAt = new Date(input.startsAt);
      if (startsAt.getTime() < Date.now()) throw problems.badRequest('აირჩიეთ მომავალი დრო');
      endsAt = new Date(startsAt.getTime() + 30 * 60_000);
      status = 'requested';
    } else throw problems.badRequest('აირჩიეთ დრო');
    const videoUrl = input.mode === 'video' ? `https://meet.jit.si/lokacia-${randomBytes(6).toString('hex')}` : null;
    const [row] = await this.dbs.db
      .insert(viewings)
      .values({ listingId: l.id, userId: user.id, slotId, startsAt, endsAt, mode: input.mode, status, videoUrl, note: input.note ?? null })
      .returning();
    const vars = { title: l.title, when: tbilisiWhen(startsAt), mode: input.mode === 'video' ? 'ვიდეოჩვენება' : 'ადგილზე', kind, price: priceMinor ? formatMoney(priceMinor) : undefined };
    await this.notify.notify({ userId: this.hostId(l), template: status === 'requested' ? 'viewing_requested' : 'viewing_booked', vars, link: `/account/viewings?v=${row!.id}`, category: 'viewings' });
    await this.notify.notify({ userId: user.id, template: status === 'requested' ? 'viewing_requested' : 'viewing_booked', vars, link: `/account/viewings?v=${row!.id}`, category: 'viewings' });
    return this.getDto(user, row!.id);
  }

  private async load(user: AuthUser, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('ჩვენება');
    const v = await this.dbs.db.query.viewings.findFirst({ where: and(eq(viewings.id, id), isNull(viewings.deletedAt)) });
    if (!v) throw problems.notFound('ჩვენება');
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, v.listingId) });
    if (!l) throw problems.notFound('ჩვენება');
    const isVisitor = v.userId === user.id;
    const isHost = await this.read.canManage(l, user);
    if (!isVisitor && !isHost) throw problems.notFound('ჩვენება');
    return { v, l, role: (isVisitor ? 'visitor' : 'host') as 'visitor' | 'host' };
  }

  async getDto(user: AuthUser, id: string) {
    const { v } = await this.load(user, id);
    return (await this.toDtos(user, [v]))[0]!;
  }

  async list(user: AuthUser, q: { role: 'all' | 'visitor' | 'host'; from?: string; to?: string; status: 'upcoming' | 'past' | 'all' }) {
    const managed = sql`${viewings.listingId} IN (SELECT l.id FROM listings l WHERE l.owner_id = ${user.id} OR l.agent_id = ${user.id})`;
    const who = q.role === 'visitor' ? eq(viewings.userId, user.id) : q.role === 'host' ? managed : sql`(${viewings.userId} = ${user.id} OR ${managed})`;
    const where = [who, isNull(viewings.deletedAt)];
    if (q.from) where.push(gte(viewings.startsAt, new Date(q.from)));
    if (q.to) where.push(lte(viewings.startsAt, new Date(q.to)));
    if (q.status === 'upcoming') where.push(gte(viewings.endsAt, new Date()), inArray(viewings.status, ['requested', 'confirmed']));
    if (q.status === 'past') where.push(sql`(${viewings.endsAt} < now() OR ${viewings.status} IN ('cancelled', 'done'))`);
    const rows = await this.dbs.db
      .select()
      .from(viewings)
      .where(and(...where))
      .orderBy(q.status === 'past' ? desc(viewings.startsAt) : asc(viewings.startsAt))
      .limit(300);
    return this.toDtos(user, rows);
  }

  private async toDtos(user: AuthUser, rows: ViewingRow[]): Promise<ViewingDto[]> {
    if (!rows.length) return [];
    const listingIds = [...new Set(rows.map((r) => r.listingId))];
    const ls = await this.dbs.db.select().from(listings).where(inArray(listings.id, listingIds));
    const lBy = new Map(ls.map((l) => [l.id, l]));
    const userIds = [...new Set([...rows.map((r) => r.userId), ...ls.map((l) => l.agentId ?? l.ownerId)])];
    const us = await this.dbs.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, userIds));
    const uBy = new Map(us.map((u) => [u.id, u]));
    const slotIds = rows.map((r) => r.slotId).filter((x): x is string => !!x);
    const slots = slotIds.length ? await this.dbs.db.select().from(availabilitySlots).where(inArray(availabilitySlots.id, slotIds)) : [];
    const sBy = new Map(slots.map((s) => [s.id, s]));
    const covers = await this.dbs.db
      .select({ listingId: listingMedia.listingId, url: listingMedia.url, variants: listingMedia.variants })
      .from(listingMedia)
      .where(and(inArray(listingMedia.listingId, listingIds), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt)))
      .orderBy(asc(listingMedia.sort));
    const coverBy = new Map<string, string>();
    for (const c of covers) if (c.listingId && !coverBy.has(c.listingId)) coverBy.set(c.listingId, c.variants?.sm ?? c.url);
    return rows.map((v) => {
      const l = lBy.get(v.listingId)!;
      const hostId = l.agentId ?? l.ownerId;
      const slot = v.slotId ? sBy.get(v.slotId) : undefined;
      const myRole = v.userId === user.id ? 'visitor' : 'host';
      const visitor = uBy.get(v.userId);
      const host = uBy.get(hostId);
      const active = v.status === 'confirmed' || v.status === 'requested';
      return {
        id: v.id,
        listingId: v.listingId,
        slotId: v.slotId,
        kind: slot?.kind ?? 'viewing',
        startsAt: v.startsAt.toISOString(),
        endsAt: v.endsAt.toISOString(),
        mode: v.mode,
        status: v.status,
        videoUrl: v.videoUrl,
        note: v.note,
        priceMinor: slot?.priceMinor ?? null,
        myRole,
        listing: { id: l.id, slug: l.slug, title: l.title, address: l.address, cover: coverBy.get(l.id) ?? null },
        // phones are shared between the two parties of a confirmed booking only
        visitor: { id: v.userId, name: visitor?.name ?? null, phone: myRole === 'host' && active ? (visitor?.phone ?? null) : null },
        host: { id: hostId, name: host?.name ?? null, phone: myRole === 'visitor' && v.status === 'confirmed' ? (host?.phone ?? null) : null },
        icsUrl: `/api/v1/viewings/${v.id}/ics`,
      };
    });
  }

  async ics(user: AuthUser, id: string) {
    const { v, l } = await this.load(user, id);
    const body = buildIcs({
      uid: v.id,
      start: v.startsAt,
      end: v.endsAt,
      title: `ჩვენება: ${l.title}`,
      description: [v.mode === 'video' ? `ვიდეოჩვენება: ${v.videoUrl}` : 'ჩვენება ადგილზე', v.note ?? ''].filter(Boolean).join('\n'),
      location: v.mode === 'video' ? (v.videoUrl ?? undefined) : l.address,
      url: `${process.env.APP_URL ?? 'http://localhost:3100'}/listings/${l.slug}`,
    });
    return { filename: `lokacia-viewing-${v.id.slice(0, 8)}.ics`, body };
  }

  private async otherParty(user: AuthUser, v: ViewingRow, l: ListingRow) {
    return v.userId === user.id ? this.hostId(l) : v.userId;
  }

  async confirm(user: AuthUser, id: string) {
    const { v, l, role } = await this.load(user, id);
    if (role !== 'host') throw problems.forbidden('ჩვენებას ადასტურებს მესაკუთრე');
    if (v.status !== 'requested') throw problems.invalidTransition(v.status, 'confirmed');
    await this.dbs.db.update(viewings).set({ status: 'confirmed' }).where(eq(viewings.id, v.id));
    await this.notify.notify({ userId: v.userId, template: 'viewing_confirmed', vars: { title: l.title, when: tbilisiWhen(v.startsAt) }, link: `/account/viewings?v=${v.id}`, category: 'viewings' });
    return this.getDto(user, id);
  }

  async cancel(user: AuthUser, id: string, reason: string | null) {
    const { v, l } = await this.load(user, id);
    if (v.status === 'cancelled' || v.status === 'done') throw problems.invalidTransition(v.status, 'cancelled');
    await this.dbs.db.transaction(async (tx) => {
      await tx.update(viewings).set({ status: 'cancelled', note: reason ? `${v.note ? `${v.note}\n` : ''}გაუქმების მიზეზი: ${reason}` : v.note }).where(eq(viewings.id, v.id));
      if (v.slotId) await tx.update(availabilitySlots).set({ bookedById: null, bookedAt: null }).where(eq(availabilitySlots.id, v.slotId));
    });
    await this.notify.notify({ userId: await this.otherParty(user, v, l), template: 'viewing_cancelled', vars: { title: l.title, when: tbilisiWhen(v.startsAt), reason: reason ?? undefined }, link: '/account/viewings', category: 'viewings' });
    return this.getDto(user, id);
  }

  async reschedule(user: AuthUser, id: string, slotId: string) {
    const { v, l } = await this.load(user, id);
    if (v.status === 'cancelled' || v.status === 'done') throw problems.invalidTransition(v.status, 'confirmed');
    const bookerId = v.userId;
    const [slot] = await this.dbs.db
      .update(availabilitySlots)
      .set({ bookedById: bookerId, bookedAt: new Date() })
      .where(and(eq(availabilitySlots.id, slotId), eq(availabilitySlots.listingId, l.id), isNull(availabilitySlots.bookedById), isNull(availabilitySlots.deletedAt), gte(availabilitySlots.startsAt, new Date())))
      .returning();
    if (!slot) throw problems.conflict('ეს დრო უკვე დაკავებულია — აირჩიეთ სხვა');
    if (v.slotId) await this.dbs.db.update(availabilitySlots).set({ bookedById: null, bookedAt: null }).where(eq(availabilitySlots.id, v.slotId));
    await this.dbs.db.update(viewings).set({ slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'confirmed', remindedAt: null }).where(eq(viewings.id, v.id));
    await this.notify.notify({ userId: await this.otherParty(user, v, l), template: 'viewing_rescheduled', vars: { title: l.title, when: tbilisiWhen(slot.startsAt) }, link: `/account/viewings?v=${v.id}`, category: 'viewings' });
    return this.getDto(user, id);
  }

  async markDone(user: AuthUser, id: string) {
    const { v, role } = await this.load(user, id);
    if (role !== 'host') throw problems.forbidden();
    if (v.status !== 'confirmed') throw problems.invalidTransition(v.status, 'done');
    await this.dbs.db.update(viewings).set({ status: 'done' }).where(eq(viewings.id, v.id));
    return this.getDto(user, id);
  }

  /** Reminder the day before (runs hourly): viewings starting in the next 24 h that were not reminded yet. */
  async remindDue(now = new Date()) {
    const rows = await this.dbs.db
      .select()
      .from(viewings)
      .where(and(eq(viewings.status, 'confirmed'), isNull(viewings.remindedAt), isNull(viewings.deletedAt), gte(viewings.startsAt, now), lte(viewings.startsAt, new Date(now.getTime() + 24 * HOUR))));
    for (const v of rows) {
      const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, v.listingId) });
      if (!l) continue;
      const vars = { title: l.title, when: tbilisiWhen(v.startsAt), video: v.videoUrl ?? undefined };
      for (const userId of [v.userId, this.hostId(l)]) {
        await this.notify.notify({ userId, template: 'viewing_reminder', vars, link: `/account/viewings?v=${v.id}`, category: 'viewings' });
      }
      await this.dbs.db.update(viewings).set({ remindedAt: now }).where(eq(viewings.id, v.id));
    }
    return rows.length;
  }
}
