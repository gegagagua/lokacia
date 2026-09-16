import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, compareLists, desc, eq, favorites, inArray, isNull, listingEvents, listings } from '@lokacia/db';
import { COMPARE_MAX, type CompareListDto, type CompareListingDto, type CompareSharedDto, type FavoriteDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AuthUser } from '../../common/request';
import { TokensService } from '../../common/tokens.service';
import { ListingReadService, PUBLIC_STATUSES } from '../listings/listing-read.service';

type CompareRow = typeof compareLists.$inferSelect;

/** P14: favorites + comparison lists with read-only share links. */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly tokens: TokensService,
  ) {}

  async list(user: AuthUser): Promise<FavoriteDto[]> {
    const rows = await this.dbs.db.query.favorites.findMany({ where: and(eq(favorites.userId, user.id), isNull(favorites.deletedAt)), orderBy: desc(favorites.createdAt), limit: 500 });
    const cards = await this.read.cards(rows.map((r) => r.listingId));
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows.flatMap((r) => {
      const c = byId.get(r.listingId);
      return c ? [{ ...c, favoritedAt: r.createdAt.toISOString(), note: r.note }] : [];
    });
  }

  async ids(user: AuthUser) {
    const rows = await this.dbs.db.select({ id: favorites.listingId }).from(favorites).where(and(eq(favorites.userId, user.id), isNull(favorites.deletedAt)));
    return rows.map((r) => r.id);
  }

  async add(user: AuthUser, listingId: string, note: string | null | undefined, ip: string) {
    const l = await this.read.findRaw(listingId);
    if (!l || !(PUBLIC_STATUSES as readonly string[]).includes(l.status)) throw problems.notFound('განცხადება');
    const existing = await this.dbs.db.query.favorites.findFirst({ where: and(eq(favorites.userId, user.id), eq(favorites.listingId, l.id)) });
    if (existing) {
      if (note !== undefined) await this.dbs.db.update(favorites).set({ note: note ?? null, deletedAt: null }).where(eq(favorites.id, existing.id));
    } else {
      await this.dbs.db.insert(favorites).values({ userId: user.id, listingId: l.id, note: note ?? null }).onConflictDoNothing();
      await this.dbs.db.insert(listingEvents).values({ listingId: l.id, type: 'save', userId: user.id, ipHash: this.tokens.ipHash(ip) });
    }
    return { ok: true, listingId: l.id, favorite: true };
  }

  async remove(user: AuthUser, listingId: string) {
    await this.dbs.db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.listingId, listingId)));
    return { ok: true, listingId, favorite: false };
  }

  /* ---------------- comparison ---------------- */

  private dto(r: CompareRow): CompareListDto {
    return { id: r.id, name: r.name, shareToken: r.shareToken, listingIds: r.listingIds, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }

  private async validIds(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length > COMPARE_MAX) throw problems.badRequest('შედარება — მაქსიმუმ 6 ფართი');
    if (!unique.length) return unique;
    const rows = await this.dbs.db.select({ id: listings.id }).from(listings).where(and(inArray(listings.id, unique), isNull(listings.deletedAt)));
    const known = new Set(rows.map((r) => r.id));
    return unique.filter((id) => known.has(id));
  }

  async compareLists(user: AuthUser) {
    const rows = await this.dbs.db.query.compareLists.findMany({ where: and(eq(compareLists.userId, user.id), isNull(compareLists.deletedAt)), orderBy: desc(compareLists.updatedAt) });
    return rows.map((r) => this.dto(r));
  }

  async createCompare(user: AuthUser, name: string, listingIds: string[]) {
    const ids = await this.validIds(listingIds);
    if (!ids.length) throw problems.badRequest('აირჩიეთ მინიმუმ ერთი ფართი');
    const [row] = await this.dbs.db.insert(compareLists).values({ userId: user.id, name, listingIds: ids, shareToken: randomBytes(12).toString('base64url') }).returning();
    return this.dto(row!);
  }

  private async ownCompare(user: AuthUser, id: string) {
    const r = await this.dbs.db.query.compareLists.findFirst({ where: and(eq(compareLists.id, id), isNull(compareLists.deletedAt)) });
    if (!r || r.userId !== user.id) throw problems.notFound('შედარება');
    return r;
  }

  async updateCompare(user: AuthUser, id: string, patch: { name?: string; listingIds?: string[] }) {
    await this.ownCompare(user, id);
    const set: Partial<typeof compareLists.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.listingIds !== undefined) set.listingIds = await this.validIds(patch.listingIds);
    const [row] = await this.dbs.db.update(compareLists).set(set).where(eq(compareLists.id, id)).returning();
    return this.dto(row!);
  }

  async deleteCompare(user: AuthUser, id: string) {
    await this.ownCompare(user, id);
    await this.dbs.db.update(compareLists).set({ deletedAt: new Date() }).where(eq(compareLists.id, id));
    return { ok: true };
  }

  /** Public read-only view by share token. */
  async shared(token: string): Promise<CompareSharedDto> {
    const r = await this.dbs.db.query.compareLists.findFirst({ where: and(eq(compareLists.shareToken, token), isNull(compareLists.deletedAt)) });
    if (!r) throw problems.notFound('შედარება');
    const out: CompareListingDto[] = [];
    for (const id of r.listingIds.slice(0, COMPARE_MAX)) {
      const l = await this.read.findRaw(id);
      if (!l || !(PUBLIC_STATUSES as readonly string[]).includes(l.status)) continue;
      const d = await this.read.detail(l);
      out.push({
        id: d.id, slug: d.slug, title: d.title, dealType: d.dealType, status: d.status, businessTypes: d.businessTypes, priceMinor: d.priceMinor, currency: d.currency,
        pricePeriod: d.pricePeriod, areaM2: d.areaM2, floor: d.floor, address: d.address, districtName: d.districtName, districtSlug: d.districtSlug, lat: d.lat, lng: d.lng,
        isOwner: d.isOwner, verifiedOwner: d.verifiedOwner, commissionPct: d.commissionPct, lastConfirmedAt: d.lastConfirmedAt, publishedAt: d.publishedAt, vip: d.vip,
        offPlan: d.offPlan, completionDate: d.completionDate, cover: d.cover, photosCount: d.photosCount, locationScore: d.locationScore,
        passport: { widthM: d.passport.widthM, depthM: d.passport.depthM, ceilingM: d.passport.ceilingM, powerKw: d.passport.powerKw },
        passportFull: d.passport,
        serviceFeeMinor: d.serviceFeeMinor,
        depositMonths: d.depositMonths,
        utilitiesIncluded: d.utilitiesIncluded,
        pricePerM2Minor: d.pricePeriod === 'month' || d.pricePeriod === 'total' ? Math.round(d.priceMinor / d.areaM2) : null,
        districtAvgPriceM2Minor: d.districtAvgPriceM2Minor,
      });
    }
    return { name: r.name, listings: out, updatedAt: r.updatedAt.toISOString() };
  }
}
