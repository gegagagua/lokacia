import { Injectable } from '@nestjs/common';
import {
  and, asc, desc, eq, inArray, isNull, listingHistory, listingMedia, listings, memberships, organizations, projects, spacePassports, sql, transferEquipment, users,
} from '@lokacia/db';
import { hasFrequentClosures, type ListingCard, type ListingDetail, type Passport } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

type ListingRow = typeof listings.$inferSelect;
type PassportRow = typeof spacePassports.$inferSelect;

export const PUBLIC_STATUSES = ['active', 'stale', 'rented', 'sold'] as const;

const passportOf = (p: PassportRow | null | undefined): Passport => ({
  powerKw: p?.powerKw ?? null,
  threePhase: p?.threePhase ?? null,
  ceilingM: p?.ceilingM ?? null,
  facadeM: p?.facadeM ?? null,
  widthM: p?.widthM ?? null,
  depthM: p?.depthM ?? null,
  hasHood: p?.hasHood ?? null,
  hasGas: p?.hasGas ?? null,
  wetPoints: p?.wetPoints ?? null,
  gateWM: p?.gateWM ?? null,
  truckAccess: p?.truckAccess ?? null,
  access247: p?.access247 ?? null,
  parking: p?.parking ?? null,
  shopWindow: p?.shopWindow ?? null,
  separateEntrance: p?.separateEntrance ?? null,
  ventilation: p?.ventilation ?? null,
  outline: p?.outline ?? null,
});

/** Single place that turns listing rows into API shapes (cards and detail). */
@Injectable()
export class ListingReadService {
  constructor(
    private readonly dbs: DbService,
    private readonly tax: TaxonomyService,
  ) {}

  async cards(ids: string[]): Promise<ListingCard[]> {
    if (!ids.length) return [];
    const rows = await this.dbs.db
      .select({ l: listings, p: spacePassports })
      .from(listings)
      .leftJoin(spacePassports, eq(spacePassports.listingId, listings.id))
      .where(and(inArray(listings.id, ids), isNull(listings.deletedAt)));
    const media = await this.dbs.db
      .select({ listingId: listingMedia.listingId, url: listingMedia.url, variants: listingMedia.variants, sort: listingMedia.sort })
      .from(listingMedia)
      .where(and(inArray(listingMedia.listingId, ids), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt), eq(listingMedia.status, 'ready')))
      .orderBy(asc(listingMedia.sort));
    const byListing = new Map<string, { url: string; variants: Record<string, string> | null }[]>();
    for (const m of media) {
      const arr = byListing.get(m.listingId!) ?? [];
      arr.push(m);
      byListing.set(m.listingId!, arr);
    }
    const out = new Map<string, ListingCard>();
    for (const { l, p } of rows) out.set(l.id, await this.toCard(l, p, byListing.get(l.id) ?? []));
    return ids.map((id) => out.get(id)).filter((x): x is ListingCard => !!x);
  }

  private async toCard(l: ListingRow, p: PassportRow | null, photos: { url: string; variants: Record<string, string> | null }[]): Promise<ListingCard> {
    const d = await this.tax.districtById(l.districtId);
    const cover = photos[0] ? (photos[0].variants?.md ?? photos[0].url) : null;
    return {
      id: l.id,
      slug: l.slug,
      title: l.title,
      dealType: l.dealType,
      status: l.status,
      businessTypes: l.businessTypes,
      priceMinor: l.priceMinor,
      currency: l.currency,
      pricePeriod: l.pricePeriod,
      areaM2: l.areaM2,
      floor: l.floor,
      address: l.address,
      districtName: d?.nameKa ?? null,
      districtSlug: d?.slug ?? null,
      lat: l.lat,
      lng: l.lng,
      isOwner: l.isOwner,
      verifiedOwner: l.verifiedOwner,
      commissionPct: l.commissionPct,
      lastConfirmedAt: l.lastConfirmedAt?.toISOString() ?? null,
      publishedAt: l.publishedAt?.toISOString() ?? null,
      vip: !!l.vipUntil && l.vipUntil > new Date(),
      offPlan: !!l.projectId,
      completionDate: l.completionDate,
      cover,
      photosCount: photos.length,
      locationScore: l.locationScore,
      passport: { widthM: p?.widthM ?? null, depthM: p?.depthM ?? null, ceilingM: p?.ceilingM ?? null, powerKw: p?.powerKw ?? null },
    };
  }

  async findRaw(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    return this.dbs.db.query.listings.findFirst({
      where: and(isUuid ? eq(listings.id, idOrSlug) : eq(listings.slug, idOrSlug), isNull(listings.deletedAt)),
    });
  }

  /** Can this user see/manage a non-public listing? Owner, assigned agent, org member, moderator/admin. */
  async canManage(l: ListingRow, user?: { id: string; role: string }) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'moderator') return true;
    if (l.ownerId === user.id || l.agentId === user.id) return true;
    if (l.orgId) {
      const m = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, l.orgId), eq(memberships.userId, user.id), eq(memberships.active, true), isNull(memberships.deletedAt)) });
      return !!m;
    }
    return false;
  }

  async detail(l: ListingRow): Promise<ListingDetail> {
    const passport = await this.dbs.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, l.id) });
    const media = await this.dbs.db.query.listingMedia.findMany({ where: and(eq(listingMedia.listingId, l.id), isNull(listingMedia.deletedAt)), orderBy: asc(listingMedia.sort) });
    const history = await this.dbs.db.query.listingHistory.findMany({ where: and(eq(listingHistory.listingId, l.id), isNull(listingHistory.deletedAt)), orderBy: desc(listingHistory.startedAt) });
    const equipment = await this.dbs.db.query.transferEquipment.findMany({ where: and(eq(transferEquipment.listingId, l.id), isNull(transferEquipment.deletedAt)) });
    const project = l.projectId ? await this.dbs.db.query.projects.findFirst({ where: eq(projects.id, l.projectId) }) : null;
    const contactUserId = l.agentId ?? l.ownerId;
    const contactUser = await this.dbs.db.query.users.findFirst({ where: eq(users.id, contactUserId) });
    const org = l.orgId ? await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, l.orgId) }) : null;
    const photos = media.filter((m) => m.kind === 'photo' && m.status === 'ready');
    const card = await this.toCard(l, passport ?? null, photos);
    const district = await this.tax.districtById(l.districtId);
    return {
      ...card,
      passport: passportOf(passport),
      description: l.description,
      descriptionEn: l.descriptionEn,
      descriptionRu: l.descriptionRu,
      floorsTotal: l.floorsTotal,
      priceHourMinor: l.priceHourMinor,
      priceDayMinor: l.priceDayMinor,
      serviceFeeMinor: l.serviceFeeMinor,
      depositMonths: l.depositMonths,
      utilitiesIncluded: l.utilitiesIncluded,
      equipmentPriceMinor: l.equipmentPriceMinor,
      videoUrl: l.videoUrl,
      tourUrl: l.tourUrl,
      districtId: l.districtId,
      ownerId: l.ownerId,
      orgId: l.orgId,
      projectId: l.projectId,
      media: media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, variants: m.variants, width: m.width, height: m.height, alt: m.alt, isFloorplan: m.isFloorplan })),
      history: history.map((h) => ({ id: h.id, businessName: h.businessName, businessType: h.businessType, startedAt: h.startedAt, endedAt: h.endedAt, note: h.note })),
      equipment: equipment.map((e) => ({ id: e.id, name: e.name, qty: e.qty, priceMinor: e.priceMinor })),
      closuresWarning: hasFrequentClosures(history),
      project: project ? { id: project.id, name: project.name, slug: project.slug, completionDate: project.completionDate } : null,
      contact: {
        name: contactUser?.name ?? 'მესაკუთრე',
        kind: l.isOwner ? 'owner' : 'broker',
        orgName: org?.name ?? null,
        orgSlug: org?.slug ?? null,
        brokerSlug: !l.isOwner ? (contactUser?.slug ?? null) : null,
        avatarUrl: contactUser?.avatarUrl ?? null,
      },
      districtAvgPriceM2Minor: district?.avgPriceM2Minor ?? null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  /** Nearby similar active listings (same primary type, closest first). */
  async similar(l: ListingRow, limit = 6) {
    const bt = l.businessTypes[0];
    const rows = await this.dbs.db.execute<{ id: string }>(sql`
      select id from listings
      where status = 'active' and deleted_at is null and id <> ${l.id}
        ${bt ? sql`and business_types @> ARRAY[${bt}]::text[]` : sql``}
        and deal_type = ${l.dealType}
      order by ${l.lat != null && l.lng != null ? sql`geom <-> ST_SetSRID(ST_MakePoint(${l.lng}, ${l.lat}), 4326)::geography` : sql`published_at desc`}
      limit ${limit}`);
    return this.cards(rows.map((r) => r.id));
  }
}
