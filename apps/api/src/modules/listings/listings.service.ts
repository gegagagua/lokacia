import { Injectable } from '@nestjs/common';
import {
  and, asc, availabilitySlots, desc, eq, gte, inArray, isNull, listingEvents, listingHistory, listingMedia, listings, livenessChecks, memberships,
  ownerVerifications, spacePassports, sql, transferEquipment, users, type Tx,
} from '@lokacia/db';
import {
  BUSINESS_TYPE_BY_SLUG, canTransition, slugify, type ListingInput, type ListingStatus, type PassportKey,
} from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems, ProblemException } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import { RateLimitService, RedisService } from '../../common/redis.service';
import { SettingsService } from '../../common/settings.service';
import { TokensService } from '../../common/tokens.service';
import type { AuthUser } from '../../common/request';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { ListingReadService, PUBLIC_STATUSES } from './listing-read.service';

type ListingRow = typeof listings.$inferSelect;

@Injectable()
export class ListingsService {
  constructor(
    private readonly dbs: DbService,
    readonly read: ListingReadService,
    private readonly search: SearchService,
    private readonly tax: TaxonomyService,
    private readonly queue: QueueService,
    private readonly rate: RateLimitService,
    private readonly redis: RedisService,
    private readonly tokens: TokensService,
    private readonly settings: SettingsService,
    private readonly notify: NotificationsService,
  ) {}

  async getManageable(id: string, user: AuthUser) {
    const l = await this.read.findRaw(id);
    if (!l) throw problems.notFound('განცხადება');
    if (!(await this.read.canManage(l, user))) throw problems.forbidden();
    return l;
  }

  /** Public detail. Non-public statuses only for managers. */
  async detail(idOrSlug: string, user?: AuthUser) {
    const l = await this.read.findRaw(idOrSlug);
    if (!l) throw problems.notFound('განცხადება');
    const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(l.status);
    const canManage = await this.read.canManage(l, user);
    if (!isPublic && !canManage) throw problems.notFound('განცხადება');
    const detail = await this.read.detail(l);
    return { ...detail, canManage };
  }

  /** Validate business-type required passport fields (P2) — only when submitting for review. */
  private async missingRequired(input: Pick<ListingInput, 'businessTypes' | 'passport'>) {
    const missing = new Set<PassportKey>();
    for (const slug of input.businessTypes) {
      const bt = (await this.tax.businessType(slug)) ?? null;
      const req = (bt?.filterConfig?.required ?? BUSINESS_TYPE_BY_SLUG[slug]?.filterConfig.required ?? []) as PassportKey[];
      for (const k of req) {
        const v = input.passport?.[k];
        if (v === undefined || v === null) missing.add(k);
      }
    }
    return [...missing];
  }

  private async orgContext(user: AuthUser, orgId?: string | null) {
    if (!orgId) return null;
    const m = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, orgId), eq(memberships.userId, user.id), eq(memberships.active, true), isNull(memberships.deletedAt)) });
    if (!m && user.role !== 'admin') throw problems.forbidden('თქვენ არ ხართ ამ ორგანიზაციის წევრი');
    return orgId;
  }

  private async writeChildren(tx: Tx, listingId: string, input: Partial<ListingInput>, uploaderId: string) {
    if (input.passport) {
      await tx
        .insert(spacePassports)
        .values({ listingId, ...input.passport })
        .onConflictDoUpdate({ target: spacePassports.listingId, set: { ...input.passport, updatedAt: new Date() } });
    }
    if (input.history) {
      await tx.delete(listingHistory).where(eq(listingHistory.listingId, listingId));
      if (input.history.length) await tx.insert(listingHistory).values(input.history.map(({ id: _id, ...h }) => ({ ...h, listingId })));
    }
    if (input.equipment) {
      await tx.delete(transferEquipment).where(eq(transferEquipment.listingId, listingId));
      if (input.equipment.length) await tx.insert(transferEquipment).values(input.equipment.map((e) => ({ ...e, listingId })));
    }
    if (input.mediaIds) {
      // attach uploaded media (only uploader's own orphan media or already attached) and apply order
      for (const [i, id] of input.mediaIds.entries()) {
        await tx
          .update(listingMedia)
          .set({ listingId, sort: i })
          .where(and(eq(listingMedia.id, id), sql`(${listingMedia.listingId} = ${listingId} OR (${listingMedia.listingId} IS NULL AND ${listingMedia.uploaderId} = ${uploaderId}))`));
      }
    }
  }

  async create(user: AuthUser, input: ListingInput, opts: { orgId?: string | null; submit?: boolean }) {
    const orgId = await this.orgContext(user, opts.orgId);
    const districtId = input.districtId ?? (await this.tax.districtAt(input.lat, input.lng));
    const district = await this.tax.districtById(districtId);
    if (opts.submit) {
      const missing = await this.missingRequired(input);
      if (missing.length) throw new ProblemException(422, 'passport-incomplete', 'ტექნიკური პასპორტი არასრულია', missing.join(', '), { errors: missing.map((m) => ({ path: `passport.${m}`, message: 'სავალდებულო ველი' })) });
    }
    const base = slugify(`${BUSINESS_TYPE_BY_SLUG[input.businessTypes[0]!]?.nameEn ?? 'space'} ${input.areaM2}m2 ${district?.slug ?? input.city}`);
    const slug = `${base}-${Date.now().toString(36)}`;
    const equipmentPriceMinor = input.dealType === 'transfer' ? input.equipment.reduce((a, e) => a + e.priceMinor * e.qty, 0) || null : null;
    const listing = await this.dbs.db.transaction(async (tx) => {
      const { passport: _p, history: _h, equipment: _e, mediaIds: _m, ...fields } = input;
      const [row] = await tx
        .insert(listings)
        .values({
          ...fields,
          slug,
          districtId,
          orgId,
          ownerId: user.id,
          agentId: orgId ? user.id : null,
          isOwner: orgId ? false : input.isOwner,
          commissionPct: orgId ? (input.commissionPct ?? 0) : input.isOwner ? null : input.commissionPct,
          pricePeriod: input.dealType === 'sale' || input.dealType === 'transfer' ? 'total' : 'month',
          equipmentPriceMinor,
          status: opts.submit ? 'pending_review' : 'draft',
        })
        .returning();
      await this.writeChildren(tx, row!.id, input, user.id);
      return row!;
    });
    await this.search.listingChanged(listing.id);
    return this.read.detail(listing);
  }

  async update(user: AuthUser, id: string, input: Partial<ListingInput>) {
    const l = await this.getManageable(id, user);
    const { passport: _p, history: _h, equipment: _e, mediaIds: _m, ...fields } = input;
    const patch: Partial<typeof listings.$inferInsert> = { ...fields };
    if (input.lat != null && input.lng != null && !input.districtId) patch.districtId = await this.tax.districtAt(input.lat, input.lng);
    if (input.dealType) patch.pricePeriod = input.dealType === 'sale' || input.dealType === 'transfer' ? 'total' : 'month';
    if (input.equipment && (input.dealType ?? l.dealType) === 'transfer') patch.equipmentPriceMinor = input.equipment.reduce((a, e) => a + e.priceMinor * e.qty, 0);
    // Material changes to an active listing by a non-moderator go back to review (title/description/photos/price stay live: only type/location)
    const material = input.address !== undefined || input.businessTypes !== undefined || input.dealType !== undefined;
    if (material && l.status === 'active' && user.role !== 'admin' && user.role !== 'moderator') patch.status = 'pending_review';
    const updated = await this.dbs.db.transaction(async (tx) => {
      const [row] = await tx.update(listings).set(patch).where(eq(listings.id, l.id)).returning();
      await this.writeChildren(tx, l.id, input, user.id);
      return row!;
    });
    await this.search.listingChanged(l.id);
    return this.read.detail(updated);
  }

  /** Lifecycle state machine (ARCHITECTURE.md). */
  async changeStatus(user: AuthUser, id: string, to: ListingStatus, reason?: string) {
    const l = await this.getManageable(id, user);
    const isMod = user.role === 'admin' || user.role === 'moderator';
    if (l.status === to) return this.read.detail(l);
    if (!canTransition(l.status, to)) throw problems.invalidTransition(l.status, to);
    if ((to === 'active' && l.status === 'pending_review') || to === 'rejected') {
      if (!isMod) throw problems.forbidden('მოდერაცია — მხოლოდ მოდერატორი');
    }
    if (to === 'pending_review') {
      const passport = await this.dbs.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, l.id) });
      const missing = await this.missingRequired({ businessTypes: l.businessTypes, passport: passport ?? {} });
      if (missing.length) throw new ProblemException(422, 'passport-incomplete', 'ტექნიკური პასპორტი არასრულია', missing.join(', '), { errors: missing.map((m) => ({ path: `passport.${m}`, message: 'სავალდებულო ველი' })) });
    }
    const now = new Date();
    const patch: Partial<typeof listings.$inferInsert> = { status: to };
    if (to === 'active') {
      patch.lastConfirmedAt = now;
      patch.rejectReason = null;
      if (!l.publishedAt) patch.publishedAt = now;
    }
    if (to === 'rejected') patch.rejectReason = reason ?? 'არ შეესაბამება პლატფორმის წესებს';
    const [row] = await this.dbs.db.update(listings).set(patch).where(eq(listings.id, l.id)).returning();
    await this.search.listingChanged(l.id);
    if (to === 'active' && l.status === 'pending_review') {
      await this.notify.notify({ userId: l.ownerId, template: 'listing_approved', vars: { title: l.title }, link: `/listings/${l.slug}` });
      await this.queue.add('listings.published', { listingId: l.id });
    }
    if (to === 'rejected') await this.notify.notify({ userId: l.ownerId, template: 'listing_rejected', vars: { title: l.title, reason: patch.rejectReason ?? '' }, link: `/account/listings` });
    return this.read.detail(row!);
  }

  async remove(user: AuthUser, id: string) {
    const l = await this.getManageable(id, user);
    await this.dbs.db.update(listings).set({ deletedAt: new Date(), status: 'archived' }).where(eq(listings.id, l.id));
    await this.search.listingChanged(l.id);
    return { ok: true };
  }

  async mine(user: AuthUser, opts: { orgId?: string; status?: string }) {
    const where = [isNull(listings.deletedAt)];
    if (opts.orgId) {
      await this.orgContext(user, opts.orgId);
      where.push(eq(listings.orgId, opts.orgId));
    } else where.push(sql`(${listings.ownerId} = ${user.id} OR ${listings.agentId} = ${user.id})`);
    if (opts.status) where.push(eq(listings.status, opts.status as ListingStatus));
    const rows = await this.dbs.db.select({ id: listings.id }).from(listings).where(and(...where)).orderBy(desc(listings.updatedAt)).limit(500);
    const cards = await this.read.cards(rows.map((r) => r.id));
    const stats = await this.dbs.db.execute<{ listing_id: string; views: string; reveals: string; saves: string }>(sql`
      SELECT listing_id, sum(views) AS views, sum(reveals) AS reveals, sum(saves) AS saves FROM listing_stats_daily
      WHERE listing_id = ANY(${`{${rows.map((r) => r.id).join(',')}}`}::uuid[]) AND day >= current_date - 30 GROUP BY listing_id`);
    const byId = new Map(stats.map((s) => [s.listing_id, s]));
    const raw = await this.dbs.db.select({ id: listings.id, rejectReason: listings.rejectReason, vipUntil: listings.vipUntil }).from(listings).where(inArray(listings.id, rows.length ? rows.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000']));
    const rawById = new Map(raw.map((r) => [r.id, r]));
    return cards.map((c) => ({
      ...c,
      rejectReason: rawById.get(c.id)?.rejectReason ?? null,
      vipUntil: rawById.get(c.id)?.vipUntil ?? null,
      stats30d: { views: Number(byId.get(c.id)?.views ?? 0), reveals: Number(byId.get(c.id)?.reveals ?? 0), saves: Number(byId.get(c.id)?.saves ?? 0) },
    }));
  }

  /** Phone reveal: rate-limited per IP and user, logged as `reveal` event (CLAUDE.md personal data rule). */
  async revealPhone(idOrSlug: string, ip: string, user?: AuthUser) {
    const l = await this.read.findRaw(idOrSlug);
    if (!l || !(PUBLIC_STATUSES as readonly string[]).includes(l.status)) throw problems.notFound('განცხადება');
    const perHour = await this.settings.number('reveal_rate_limit_per_hour');
    const ipHash = this.tokens.ipHash(ip);
    await this.rate.hit(`reveal:ip:${ipHash}`, perHour || 20, 3600);
    if (user) await this.rate.hit(`reveal:user:${user.id}`, (perHour || 20) * 2, 3600);
    const contact = await this.dbs.db.query.users.findFirst({ where: eq(users.id, l.agentId ?? l.ownerId) });
    await this.dbs.db.insert(listingEvents).values({ listingId: l.id, type: 'reveal', userId: user?.id ?? null, ipHash });
    return { phone: contact?.phone ?? null, name: contact?.name ?? null };
  }

  /** View event, deduplicated per IP per listing for 30 minutes. */
  async trackView(listingId: string, ip: string, user?: AuthUser) {
    const ipHash = this.tokens.ipHash(ip);
    const key = `view:${listingId}:${ipHash}`;
    if (await this.redis.get(key)) return;
    await this.redis.set(key, '1', 1800);
    await this.dbs.db.insert(listingEvents).values({ listingId, type: 'view', userId: user?.id ?? null, ipHash });
  }

  async trackShare(listingId: string, ip: string, user?: AuthUser) {
    await this.dbs.db.insert(listingEvents).values({ listingId, type: 'share', userId: user?.id ?? null, ipHash: this.tokens.ipHash(ip) });
    return { ok: true };
  }

  /** P4 confirm link: one tap. `answer=rented` marks as rented instead. */
  async confirmLiveness(idOrSlug: string, token: string, answer: 'available' | 'rented') {
    const l = await this.read.findRaw(idOrSlug);
    if (!l) throw problems.notFound('განცხადება');
    const check = await this.dbs.db.query.livenessChecks.findFirst({ where: and(eq(livenessChecks.listingId, l.id), eq(livenessChecks.token, token)) });
    if (!check) throw new ProblemException(410, 'link-expired', 'ბმული არასწორია ან ვადა გაუვიდა');
    const now = new Date();
    await this.dbs.db.update(livenessChecks).set({ confirmedAt: now, result: answer === 'rented' ? 'rented' : 'confirmed' }).where(eq(livenessChecks.id, check.id));
    const patch: Partial<typeof listings.$inferInsert> =
      answer === 'rented' ? { status: l.dealType === 'sale' ? 'sold' : 'rented', lastConfirmedAt: now } : { lastConfirmedAt: now, ...(l.status === 'stale' ? { status: 'active' as const } : {}) };
    const [row] = await this.dbs.db.update(listings).set(patch).where(eq(listings.id, l.id)).returning();
    await this.search.listingChanged(l.id);
    return { ok: true, status: row!.status, title: row!.title, slug: row!.slug };
  }

  /** Owner-initiated confirmation from the dashboard (no token). */
  async confirmByOwner(user: AuthUser, id: string) {
    const l = await this.getManageable(id, user);
    if (!['active', 'stale'].includes(l.status)) throw problems.invalidTransition(l.status, 'active');
    const [row] = await this.dbs.db.update(listings).set({ lastConfirmedAt: new Date(), status: 'active' }).where(eq(listings.id, l.id)).returning();
    await this.dbs.db.update(livenessChecks).set({ confirmedAt: new Date(), result: 'confirmed' }).where(and(eq(livenessChecks.listingId, l.id), eq(livenessChecks.result, 'pending')));
    await this.search.listingChanged(l.id);
    return this.read.detail(row!);
  }

  /* ---------- owner verification (P5) ---------- */

  async requestVerification(user: AuthUser, id: string, documentUrl: string) {
    const l = await this.getManageable(id, user);
    if (!l.isOwner) throw problems.badRequest('ვერიფიკაცია მხოლოდ მესაკუთრის განცხადებისთვის');
    const pending = await this.dbs.db.query.ownerVerifications.findFirst({ where: and(eq(ownerVerifications.listingId, l.id), eq(ownerVerifications.status, 'pending')) });
    if (pending) throw problems.conflict('მოთხოვნა უკვე განხილვაშია');
    const [row] = await this.dbs.db.insert(ownerVerifications).values({ listingId: l.id, userId: user.id, documentUrl }).returning();
    return row;
  }

  verifications(listingId: string) {
    return this.dbs.db.query.ownerVerifications.findMany({ where: eq(ownerVerifications.listingId, listingId), orderBy: desc(ownerVerifications.createdAt) });
  }

  /* ---------- availability slots (P15, P21) ---------- */

  async slots(listingId: string, kind?: 'viewing' | 'short_term') {
    const where = [eq(availabilitySlots.listingId, listingId), gte(availabilitySlots.startsAt, new Date()), isNull(availabilitySlots.deletedAt)];
    if (kind) where.push(eq(availabilitySlots.kind, kind));
    const rows = await this.dbs.db.query.availabilitySlots.findMany({ where: and(...where), orderBy: asc(availabilitySlots.startsAt), limit: 300 });
    return rows.map((s) => ({ id: s.id, kind: s.kind, startsAt: s.startsAt, endsAt: s.endsAt, priceMinor: s.priceMinor, booked: !!s.bookedById }));
  }

  async addSlots(user: AuthUser, id: string, kind: 'viewing' | 'short_term', slots: { startsAt: string; endsAt: string; priceMinor?: number | null }[]) {
    const l = await this.getManageable(id, user);
    for (const s of slots) if (new Date(s.endsAt) <= new Date(s.startsAt)) throw problems.badRequest('სლოტის დასასრული უნდა იყოს დაწყების შემდეგ');
    const rows = await this.dbs.db
      .insert(availabilitySlots)
      .values(slots.map((s) => ({ listingId: l.id, kind, startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt), priceMinor: s.priceMinor ?? null })))
      .returning();
    return rows;
  }

  async deleteSlot(user: AuthUser, id: string, slotId: string) {
    const l = await this.getManageable(id, user);
    const slot = await this.dbs.db.query.availabilitySlots.findFirst({ where: and(eq(availabilitySlots.id, slotId), eq(availabilitySlots.listingId, l.id)) });
    if (!slot) throw problems.notFound('სლოტი');
    if (slot.bookedById) throw problems.conflict('ჯავშნილი სლოტის წაშლა შეუძლებელია');
    await this.dbs.db.update(availabilitySlots).set({ deletedAt: new Date() }).where(eq(availabilitySlots.id, slotId));
    return { ok: true };
  }

  similar(l: ListingRow) {
    return this.read.similar(l);
  }
}
