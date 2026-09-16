import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { and, asc, desc, eq, inArray, isNull, listingMedia, listings, offers, sql, tenantProfiles, transferEquipment, users } from '@lokacia/db';
import { formatMoney, type OfferCreateInput, type OfferDto, type OfferListingDto, type OfferThread, type OfferThreadSummary } from '@lokacia/contracts';
import { ENV, type Env } from '../../config/env';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import type { AuthUser } from '../../common/request';
import { STORAGE, type Storage } from '../../integrations/storage/storage';
import { NotificationsService } from '../notifications/notifications.service';
import { registerTemplates } from '../notifications/templates';
import { ContractPdfService } from './contract-pdf.service';

registerTemplates({
  offer_received: { title: () => 'ახალი შეთავაზება', body: (v) => `„${v.title}“ — ${v.price}${v.term ? `, ${v.term} თვე` : ''}` },
  offer_countered: { title: () => 'კონტრ-შეთავაზება', body: (v) => `„${v.title}“ — ${v.price}${v.term ? `, ${v.term} თვე` : ''}` },
  offer_accepted: { title: () => 'შეთავაზება მიღებულია', body: (v) => `„${v.title}“ — ხელშეკრულების პროექტი მზად არის.` },
  offer_rejected: { title: () => 'შეთავაზება უარყოფილია', body: (v) => `„${v.title}“${v.reason ? `: ${v.reason}` : ''}` },
  offer_withdrawn: { title: () => 'შეთავაზება გაუქმდა', body: (v) => `„${v.title}“ — ${v.price}` },
});

type OfferRow = typeof offers.$inferSelect;
type ListingRow = typeof listings.$inferSelect;
const OFFERABLE = ['active', 'stale'];

const toDto = (o: OfferRow): OfferDto => ({
  id: o.id,
  listingId: o.listingId,
  rootOfferId: o.rootOfferId ?? o.id,
  parentOfferId: o.parentOfferId,
  fromUserId: o.fromUserId,
  toUserId: o.toUserId,
  priceMinor: o.priceMinor,
  termMonths: o.termMonths,
  freeMonths: o.freeMonths,
  indexationPct: o.indexationPct,
  fitoutPaidBy: o.fitoutPaidBy,
  equipmentIncluded: o.equipmentIncluded,
  message: o.message,
  status: o.status,
  contractUrl: o.contractUrl,
  createdAt: o.createdAt.toISOString(),
});

/** P16 offers & negotiation, P17 contract PDF, P20 tenant profile, P11 business transfer. */
@Injectable()
export class OffersService implements OnModuleInit {
  private readonly logger = new Logger('Offers');
  constructor(
    private readonly dbs: DbService,
    private readonly notify: NotificationsService,
    private readonly queue: QueueService,
    private readonly pdf: ContractPdfService,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('offers.contract', (d: { offerId: string }) => this.generateContract(d.offerId));
  }

  private money(o: { priceMinor: number }, l: ListingRow) {
    return formatMoney(o.priceMinor, l.currency);
  }

  async create(user: AuthUser, input: OfferCreateInput) {
    const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, input.listingId), isNull(listings.deletedAt)) });
    if (!l || !OFFERABLE.includes(l.status)) throw problems.notFound('განცხადება');
    const toUserId = l.agentId ?? l.ownerId;
    if (toUserId === user.id || l.ownerId === user.id) throw problems.badRequest('საკუთარ განცხადებაზე შეთავაზება შეუძლებელია');
    const open = await this.dbs.db.query.offers.findFirst({ where: and(eq(offers.listingId, l.id), eq(offers.status, 'pending'), sql`(${offers.fromUserId} = ${user.id} OR ${offers.toUserId} = ${user.id})`, isNull(offers.deletedAt)) });
    if (open) throw problems.conflict('ამ ფართზე უკვე გაქვთ აქტიური შეთავაზება — ნახეთ მოლაპარაკების ისტორია');
    if (input.tenantProfile) {
      const tp = input.tenantProfile;
      await this.dbs.db.insert(tenantProfiles).values({ userId: user.id, ...tp }).onConflictDoUpdate({ target: tenantProfiles.userId, set: { ...tp, updatedAt: new Date() } });
    }
    const { tenantProfile: _tp, listingId: _l, ...terms } = input;
    const id = uuidv7();
    const [row] = await this.dbs.db
      .insert(offers)
      .values({ ...terms, id, rootOfferId: id, listingId: l.id, fromUserId: user.id, toUserId, status: 'pending', equipmentIncluded: l.dealType === 'transfer' ? input.equipmentIncluded : false })
      .returning();
    await this.notify.notify({ userId: toUserId, template: 'offer_received', vars: { title: l.title, price: this.money(row!, l), term: l.dealType === 'sale' ? undefined : row!.termMonths }, link: `/account/offers/${row!.id}`, category: 'offers' });
    return toDto(row!);
  }

  private async loadForParticipant(user: AuthUser, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('შეთავაზება');
    const o = await this.dbs.db.query.offers.findFirst({ where: and(eq(offers.id, id), isNull(offers.deletedAt)) });
    if (!o) throw problems.notFound('შეთავაზება');
    const isMod = user.role === 'admin' || user.role === 'moderator';
    if (o.fromUserId !== user.id && o.toUserId !== user.id && !isMod) throw problems.notFound('შეთავაზება');
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, o.listingId) });
    if (!l) throw problems.notFound('განცხადება');
    return { o, l };
  }

  private async listingDto(l: ListingRow): Promise<OfferListingDto> {
    const cover = await this.dbs.db.query.listingMedia.findFirst({ where: and(eq(listingMedia.listingId, l.id), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt)), orderBy: asc(listingMedia.sort) });
    return { id: l.id, slug: l.slug, title: l.title, address: l.address, dealType: l.dealType, priceMinor: l.priceMinor, pricePeriod: l.pricePeriod, areaM2: l.areaM2, cover: cover ? (cover.variants?.sm ?? cover.url) : null, equipmentPriceMinor: l.equipmentPriceMinor };
  }

  async list(user: AuthUser, box: 'all' | 'received' | 'sent'): Promise<OfferThreadSummary[]> {
    // threads where I participate; the tenant is the author of the root offer
    const roots = await this.dbs.db
      .select()
      .from(offers)
      .where(and(sql`${offers.id} = coalesce(${offers.rootOfferId}, ${offers.id})`, sql`(${offers.fromUserId} = ${user.id} OR ${offers.toUserId} = ${user.id})`, isNull(offers.deletedAt)))
      .orderBy(desc(offers.createdAt))
      .limit(300);
    const filtered = roots.filter((r) => box === 'all' || (box === 'sent' ? r.fromUserId === user.id : r.toUserId === user.id));
    if (!filtered.length) return [];
    const rootIds = filtered.map((r) => r.id);
    const all = await this.dbs.db.select().from(offers).where(and(inArray(offers.rootOfferId, rootIds), isNull(offers.deletedAt))).orderBy(asc(offers.createdAt));
    const byRoot = new Map<string, OfferRow[]>();
    for (const o of all) byRoot.set(o.rootOfferId!, [...(byRoot.get(o.rootOfferId!) ?? []), o]);
    const ls = await this.dbs.db.select().from(listings).where(inArray(listings.id, [...new Set(filtered.map((r) => r.listingId))]));
    const lBy = new Map<string, OfferListingDto>();
    for (const l of ls) lBy.set(l.id, await this.listingDto(l));
    const counterpartIds = [...new Set(filtered.map((r) => (r.fromUserId === user.id ? r.toUserId : r.fromUserId)))];
    const us = await this.dbs.db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, counterpartIds));
    const uBy = new Map(us.map((u) => [u.id, u]));
    return filtered
      .map((r) => {
        const thread = byRoot.get(r.id) ?? [r];
        const latest = thread.at(-1)!;
        const cp = r.fromUserId === user.id ? r.toUserId : r.fromUserId;
        return {
          rootId: r.id,
          latest: toDto(latest),
          count: thread.length,
          listing: lBy.get(r.listingId)!,
          counterpart: uBy.get(cp) ?? { id: cp, name: null, avatarUrl: null },
          direction: (r.fromUserId === user.id ? 'sent' : 'received') as 'sent' | 'received',
          actionRequired: latest.status === 'pending' && latest.toUserId === user.id,
        };
      })
      .sort((a, b) => Number(b.actionRequired) - Number(a.actionRequired) || b.latest.createdAt.localeCompare(a.latest.createdAt));
  }

  async thread(user: AuthUser, id: string): Promise<OfferThread> {
    const { o, l } = await this.loadForParticipant(user, id);
    const rootId = o.rootOfferId ?? o.id;
    const chain = await this.dbs.db.select().from(offers).where(and(eq(offers.rootOfferId, rootId), isNull(offers.deletedAt))).orderBy(asc(offers.createdAt));
    const root = chain.find((c) => c.id === rootId) ?? o;
    const latest = chain.at(-1) ?? o;
    const tenantId = root.fromUserId;
    const ownerId = root.toUserId;
    const us = await this.dbs.db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [tenantId, ownerId]));
    const uBy = new Map(us.map((u) => [u.id, u]));
    const equipment = await this.dbs.db.select({ name: transferEquipment.name, qty: transferEquipment.qty, priceMinor: transferEquipment.priceMinor }).from(transferEquipment).where(and(eq(transferEquipment.listingId, l.id), isNull(transferEquipment.deletedAt)));
    const pending = latest.status === 'pending';
    const accepted = chain.find((c) => c.status === 'accepted');
    return {
      rootId,
      offers: chain.map(toDto),
      listing: { ...(await this.listingDto(l)), equipment },
      tenant: uBy.get(tenantId) ?? { id: tenantId, name: null, avatarUrl: null },
      owner: uBy.get(ownerId) ?? { id: ownerId, name: null, avatarUrl: null },
      myRole: user.id === tenantId ? 'tenant' : 'owner',
      can: {
        counter: pending && latest.toUserId === user.id,
        accept: pending && latest.toUserId === user.id,
        reject: pending && latest.toUserId === user.id,
        withdraw: pending && latest.fromUserId === user.id,
      },
      contractUrl: accepted?.contractUrl ?? null,
      status: accepted ? 'accepted' : latest.status,
    };
  }

  private async assertLatestPendingFor(o: OfferRow, userId: string, as: 'recipient' | 'sender') {
    if (o.status !== 'pending') throw problems.invalidTransition(o.status, as === 'recipient' ? 'accepted' : 'withdrawn');
    if (as === 'recipient' && o.toUserId !== userId) throw problems.forbidden('ამ შეთავაზებაზე პასუხს სცემს მეორე მხარე');
    if (as === 'sender' && o.fromUserId !== userId) throw problems.forbidden('შეთავაზებას აუქმებს მხოლოდ ავტორი');
  }

  async counter(user: AuthUser, id: string, input: { priceMinor: number; termMonths: number; freeMonths: number; indexationPct: number; fitoutPaidBy: 'tenant' | 'owner' | 'shared'; equipmentIncluded: boolean; message?: string | null }) {
    const { o, l } = await this.loadForParticipant(user, id);
    await this.assertLatestPendingFor(o, user.id, 'recipient');
    const row = await this.dbs.db.transaction(async (tx) => {
      const [done] = await tx.update(offers).set({ status: 'countered' }).where(and(eq(offers.id, o.id), eq(offers.status, 'pending'))).returning({ id: offers.id });
      if (!done) throw problems.conflict('შეთავაზების სტატუსი უკვე შეიცვალა');
      const [c] = await tx
        .insert(offers)
        .values({ ...input, message: input.message ?? null, equipmentIncluded: l.dealType === 'transfer' ? input.equipmentIncluded : false, listingId: o.listingId, fromUserId: user.id, toUserId: o.fromUserId, parentOfferId: o.id, rootOfferId: o.rootOfferId ?? o.id, status: 'pending' })
        .returning();
      return c!;
    });
    await this.notify.notify({ userId: o.fromUserId, template: 'offer_countered', vars: { title: l.title, price: this.money(row, l), term: l.dealType === 'sale' ? undefined : row.termMonths }, link: `/account/offers/${row.id}`, category: 'offers' });
    return toDto(row);
  }

  async accept(user: AuthUser, id: string) {
    const { o, l } = await this.loadForParticipant(user, id);
    await this.assertLatestPendingFor(o, user.id, 'recipient');
    const [row] = await this.dbs.db.update(offers).set({ status: 'accepted' }).where(and(eq(offers.id, o.id), eq(offers.status, 'pending'))).returning();
    if (!row) throw problems.conflict('შეთავაზების სტատუსი უკვე შეიცვალა');
    await this.queue.add('offers.contract', { offerId: row.id });
    for (const uid of [o.fromUserId, o.toUserId]) {
      await this.notify.notify({ userId: uid, template: 'offer_accepted', vars: { title: l.title }, link: `/account/offers/${row.id}`, category: 'offers' });
    }
    return toDto(row);
  }

  async reject(user: AuthUser, id: string, reason: string | null) {
    const { o, l } = await this.loadForParticipant(user, id);
    await this.assertLatestPendingFor(o, user.id, 'recipient');
    const [row] = await this.dbs.db.update(offers).set({ status: 'rejected', message: reason ? `${o.message ? `${o.message}\n\n` : ''}უარის მიზეზი: ${reason}` : o.message }).where(eq(offers.id, o.id)).returning();
    await this.notify.notify({ userId: o.fromUserId, template: 'offer_rejected', vars: { title: l.title, reason: reason ?? undefined }, link: `/account/offers/${o.id}`, category: 'offers' });
    return toDto(row!);
  }

  async withdraw(user: AuthUser, id: string) {
    const { o, l } = await this.loadForParticipant(user, id);
    await this.assertLatestPendingFor(o, user.id, 'sender');
    const [row] = await this.dbs.db.update(offers).set({ status: 'withdrawn' }).where(eq(offers.id, o.id)).returning();
    await this.notify.notify({ userId: o.toUserId, template: 'offer_withdrawn', vars: { title: l.title, price: this.money(o, l) }, link: `/account/offers/${o.id}`, category: 'offers' });
    return toDto(row!);
  }

  private contractKey(offerId: string) {
    return `contracts/${offerId}.pdf`;
  }

  /** Background job: renders the PDF, stores it, sets `offers.contract_url` (private download endpoint). */
  async generateContract(offerId: string) {
    const o = await this.dbs.db.query.offers.findFirst({ where: eq(offers.id, offerId) });
    if (!o || o.status !== 'accepted') return null;
    const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, o.listingId) });
    if (!l) return null;
    const root = o.rootOfferId ? await this.dbs.db.query.offers.findFirst({ where: eq(offers.id, o.rootOfferId) }) : o;
    const tenantId = root?.fromUserId ?? o.fromUserId;
    const ownerId = root?.toUserId ?? o.toUserId;
    const [tenant, owner] = await Promise.all([this.dbs.db.query.users.findFirst({ where: eq(users.id, tenantId) }), this.dbs.db.query.users.findFirst({ where: eq(users.id, ownerId) })]);
    const tp = await this.dbs.db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, tenantId) });
    const equipment = await this.dbs.db.select({ name: transferEquipment.name, qty: transferEquipment.qty, priceMinor: transferEquipment.priceMinor }).from(transferEquipment).where(and(eq(transferEquipment.listingId, l.id), isNull(transferEquipment.deletedAt)));
    const buffer = await this.pdf.render({
      number: `LK-${o.createdAt.getFullYear()}-${o.id.slice(-6).toUpperCase()}`,
      date: new Date(),
      owner: { name: owner?.name ?? 'მესაკუთრე', phone: owner?.phone ?? null, email: owner?.email ?? null },
      tenant: { name: tenant?.name ?? 'მოიჯარე', phone: tenant?.phone ?? null, email: tenant?.email ?? null, company: tp?.companyName ?? null, activity: tp?.activity ?? null },
      listing: { title: l.title, address: l.address, areaM2: l.areaM2, floor: l.floor, dealType: l.dealType, url: `${this.env.APP_URL}/listings/${l.slug}` },
      offer: { priceMinor: o.priceMinor, currency: l.currency, termMonths: o.termMonths, freeMonths: o.freeMonths, indexationPct: o.indexationPct, fitoutPaidBy: o.fitoutPaidBy, equipmentIncluded: o.equipmentIncluded, message: o.message },
      equipment: l.dealType === 'transfer' ? equipment : [],
      depositMonths: l.depositMonths,
      serviceFeeMinor: l.serviceFeeMinor,
      consultationUrl: `${this.env.APP_URL}/services?category=legal`,
    });
    await this.storage.put(this.contractKey(o.id), buffer, 'application/pdf');
    const contractUrl = `/api/v1/offers/${o.id}/contract?v=${randomBytes(3).toString('hex')}`;
    await this.dbs.db.update(offers).set({ contractUrl }).where(eq(offers.id, o.id));
    this.logger.log(`contract generated for offer ${o.id} (${buffer.length} bytes)`);
    return contractUrl;
  }

  async regenerateContract(user: AuthUser, id: string) {
    const { o } = await this.loadForParticipant(user, id);
    const rootId = o.rootOfferId ?? o.id;
    const acc = await this.dbs.db.query.offers.findFirst({ where: and(eq(offers.rootOfferId, rootId), eq(offers.status, 'accepted')) });
    if (!acc) throw problems.badRequest('ხელშეკრულება — მხოლოდ მიღებული შეთავაზებისთვის');
    const contractUrl = await this.generateContract(acc.id);
    return { contractUrl };
  }

  async contractFile(user: AuthUser, id: string) {
    const { o } = await this.loadForParticipant(user, id);
    const rootId = o.rootOfferId ?? o.id;
    const acc = o.status === 'accepted' ? o : await this.dbs.db.query.offers.findFirst({ where: and(eq(offers.rootOfferId, rootId), eq(offers.status, 'accepted')) });
    if (!acc) throw problems.notFound('ხელშეკრულება');
    let buffer = await this.storage.get(this.contractKey(acc.id));
    if (!buffer) {
      await this.generateContract(acc.id);
      buffer = await this.storage.get(this.contractKey(acc.id));
    }
    if (!buffer) throw problems.notFound('ხელშეკრულება');
    return { buffer, filename: `lokacia-contract-${acc.id.slice(-6)}.pdf` };
  }
}
