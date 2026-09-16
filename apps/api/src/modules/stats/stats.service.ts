import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, eq, favorites, isNull, listingMedia, listingStatsDaily, listings, savedSearches, spacePassports, sql, tenantProfiles } from '@lokacia/db';
import { explainAdvice, type AiClient } from '@lokacia/ai';
import {
  BUSINESS_TYPE_BY_SLUG, formatMoney, type AccountSummaryDto, type AdviceItem, type ListingStatsDto, type PassportKey, type StatsPoint, type StatsTotals,
} from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { QueueService } from '../../common/queue.service';
import { SettingsService } from '../../common/settings.service';
import type { AuthUser } from '../../common/request';
import { AI } from '../../integrations/integrations.module';
import { GeoService } from '../geo/geo.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

const DAY = 86_400_000;
const zero = (): StatsTotals => ({ views: 0, reveals: 0, saves: 0, shares: 0 });
/** Calendar day in Tbilisi (UTC+4, no DST). */
export const tbilisiDay = (d: Date) => new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const BASE_PASSPORT: PassportKey[] = ['widthM', 'depthM', 'ceilingM', 'powerKw'];

@Injectable()
export class StatsService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly settings: SettingsService,
    private readonly listings: ListingsService,
    private readonly geo: GeoService,
    private readonly tax: TaxonomyService,
    private readonly chat: MessagingService,
    @Inject(AI) private readonly ai: AiClient,
  ) {}

  onModuleInit() {
    this.queue.register('stats.aggregate', (d: { from?: string; to?: string }) => this.aggregate(d?.from, d?.to));
    this.queue.every('stats.aggregate', 3600_000);
  }

  /**
   * Daily aggregation (P19): listing_events → listing_stats_daily for [from, to] (Tbilisi days, default yesterday..today).
   * Idempotent: recomputes each (listing, day) from raw events and upserts.
   */
  async aggregate(from?: string, to?: string, now = new Date()) {
    const end = to ?? tbilisiDay(now);
    const start = from ?? addDays(end, -1);
    const res = await this.dbs.db.execute(sql`
      INSERT INTO listing_stats_daily (id, listing_id, day, views, reveals, saves, shares, created_at, updated_at)
      SELECT gen_random_uuid(), listing_id, day, views, reveals, saves, shares, now(), now() FROM (
        SELECT listing_id, (at AT TIME ZONE 'Asia/Tbilisi')::date AS day,
          count(*) FILTER (WHERE type = 'view')::int AS views,
          count(*) FILTER (WHERE type = 'reveal')::int AS reveals,
          count(*) FILTER (WHERE type = 'save')::int AS saves,
          count(*) FILTER (WHERE type = 'share')::int AS shares
        FROM listing_events
        WHERE deleted_at IS NULL AND (at AT TIME ZONE 'Asia/Tbilisi')::date BETWEEN ${start}::date AND ${end}::date
        GROUP BY 1, 2
      ) agg
      ON CONFLICT (listing_id, day) DO UPDATE SET views = EXCLUDED.views, reveals = EXCLUDED.reveals, saves = EXCLUDED.saves, shares = EXCLUDED.shares, updated_at = now()`);
    return (res as unknown as { count?: number }).count ?? 0;
  }

  private async totals(listingId: string, from: string, to: string): Promise<StatsTotals> {
    const [r] = await this.dbs.db
      .select({ views: sql<number>`coalesce(sum(views),0)::int`, reveals: sql<number>`coalesce(sum(reveals),0)::int`, saves: sql<number>`coalesce(sum(saves),0)::int`, shares: sql<number>`coalesce(sum(shares),0)::int` })
      .from(listingStatsDaily)
      .where(and(eq(listingStatsDaily.listingId, listingId), sql`${listingStatsDaily.day} BETWEEN ${from}::date AND ${to}::date`, isNull(listingStatsDaily.deletedAt)));
    return { views: Number(r?.views ?? 0), reveals: Number(r?.reveals ?? 0), saves: Number(r?.saves ?? 0), shares: Number(r?.shares ?? 0) };
  }

  async listingDashboard(user: AuthUser, id: string, days = 30): Promise<ListingStatsDto> {
    const l = await this.listings.getManageable(id, user);
    const today = tbilisiDay(new Date());
    const from = addDays(today, -(days - 1));
    const rows = await this.dbs.db
      .select()
      .from(listingStatsDaily)
      .where(and(eq(listingStatsDaily.listingId, l.id), sql`${listingStatsDaily.day} BETWEEN ${from}::date AND ${today}::date`, isNull(listingStatsDaily.deletedAt)));
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const series: StatsPoint[] = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(from, i);
      const r = byDay.get(day);
      series.push({ day, views: r?.views ?? 0, reveals: r?.reveals ?? 0, saves: r?.saves ?? 0, shares: r?.shares ?? 0 });
    }
    const totals = series.reduce((a, p) => ({ views: a.views + p.views, reveals: a.reveals + p.reveals, saves: a.saves + p.saves, shares: a.shares + p.shares }), zero());
    const previousTotals = await this.totals(l.id, addDays(from, -days), addDays(from, -1));

    const district = await this.tax.districtById(l.districtId);
    const [avg] = l.districtId
      ? await this.dbs.db.execute<{ n: number; views: number; reveals: number; saves: number; shares: number }>(sql`
          SELECT count(DISTINCT l.id)::int AS n, coalesce(sum(s.views),0)::int AS views, coalesce(sum(s.reveals),0)::int AS reveals,
            coalesce(sum(s.saves),0)::int AS saves, coalesce(sum(s.shares),0)::int AS shares
          FROM listings l LEFT JOIN listing_stats_daily s ON s.listing_id = l.id AND s.day BETWEEN ${from}::date AND ${today}::date
          WHERE l.district_id = ${l.districtId} AND l.deal_type = ${l.dealType} AND l.status IN ('active','stale') AND l.deleted_at IS NULL`)
      : [];
    const n = Number(avg?.n ?? 0);
    const per = (v: number | undefined) => (n ? Math.round(Number(v ?? 0) / n) : 0);
    const districtAvg = { views: per(avg?.views), reveals: per(avg?.reveals), saves: per(avg?.saves), shares: per(avg?.shares), listings: n, districtName: district?.nameKa ?? null };

    const [counts] = await this.dbs.db.execute<{ offers: number; viewings: number }>(sql`
      SELECT (SELECT count(*)::int FROM offers WHERE listing_id = ${l.id} AND id = coalesce(root_offer_id, id) AND deleted_at IS NULL AND created_at >= ${from}::date) AS offers,
             (SELECT count(*)::int FROM viewings WHERE listing_id = ${l.id} AND deleted_at IS NULL AND created_at >= ${from}::date) AS viewings`);

    const photos = await this.dbs.db
      .select({ kind: listingMedia.kind, isFloorplan: listingMedia.isFloorplan })
      .from(listingMedia)
      .where(and(eq(listingMedia.listingId, l.id), isNull(listingMedia.deletedAt)));
    const photosCount = photos.filter((p) => p.kind === 'photo').length;
    const hasPlan = photos.some((p) => p.kind === 'plan' || p.isFloorplan);
    const passport = await this.dbs.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, l.id) });
    const relevant = new Set<PassportKey>(BASE_PASSPORT);
    const required = new Set<PassportKey>();
    for (const bt of l.businessTypes) {
      const cfg = (await this.tax.businessType(bt))?.filterConfig ?? BUSINESS_TYPE_BY_SLUG[bt]?.filterConfig;
      for (const k of (cfg?.required ?? []) as PassportKey[]) {
        relevant.add(k);
        required.add(k);
      }
      for (const f of cfg?.filters ?? []) relevant.add(f.key as PassportKey);
    }
    const filled = [...relevant].filter((k) => passport && (passport as Record<string, unknown>)[k] != null);
    const passportCompletenessPct = relevant.size ? Math.round((filled.length / relevant.size) * 100) : 100;
    const missingRequired = [...required].filter((k) => !passport || (passport as Record<string, unknown>)[k] == null);

    const priceRaw = ['rent', 'short_term'].includes(l.dealType) ? await this.geo.priceCheck({ districtId: l.districtId, areaM2: l.areaM2, priceMinor: l.priceMinor, businessType: l.businessTypes[0], dealType: l.dealType }) : null;
    const price = priceRaw ? { deltaPct: priceRaw.deltaPct, verdict: priceRaw.verdict, messageKa: priceRaw.messageKa, recommendedMinor: priceRaw.recommendedMinor, districtAvgM2Minor: priceRaw.districtAvgM2Minor, perM2Minor: priceRaw.perM2Minor } : null;
    const revealRatePct = totals.views ? Math.round((totals.reveals / totals.views) * 1000) / 10 : null;

    const intervalDays = (await this.settings.number('liveness_interval_days')) || 12;
    const edit = `/account/listings/${l.id}/edit`;
    const advice: AdviceItem[] = [];
    if (price && price.verdict === 'above')
      advice.push({ key: 'price_high', severity: price.deltaPct >= 25 ? 'high' : 'medium', messageKa: `${price.messageKa}. რაიონის საშუალოზე დაფუძნებული ფასი — ${formatMoney(price.recommendedMinor)}.`, action: { labelKa: 'ფასის შეცვლა', href: `${edit}?step=price` } });
    if (l.status === 'stale' || (l.status === 'active' && l.lastConfirmedAt && Date.now() - l.lastConfirmedAt.getTime() > intervalDays * DAY))
      advice.push({ key: 'liveness_overdue', severity: 'high', messageKa: l.status === 'stale' ? 'განცხადება დამალულია ძებნიდან, რადგან სტატუსი არ დადასტურდა. დაადასტურეთ, რომ ფართი ისევ თავისუფალია.' : `სტატუსი ${intervalDays} დღეზე ადრე დადასტურდა — დაადასტურეთ, რომ ფართი ისევ თავისუფალია.`, action: { labelKa: 'სტატუსის დადასტურება', href: '/account/listings' } });
    if (photosCount < 5)
      advice.push({ key: 'few_photos', severity: photosCount < 3 ? 'high' : 'medium', messageKa: `განცხადებაში ${photosCount} ფოტოია. 5+ ფოტოიან განცხადებები უფრო ხშირად იღებენ ზარებს — დაამატეთ ფასადის, შესასვლელის და ინტერიერის ფოტოები.`, action: { labelKa: 'ფოტოების დამატება', href: `${edit}?step=media` } });
    if (missingRequired.length || passportCompletenessPct < 70)
      advice.push({ key: 'passport_incomplete', severity: missingRequired.length ? 'high' : 'medium', messageKa: `ტექნიკური პასპორტი ${passportCompletenessPct}%-ით შევსებულია. ბიზნესი ფილტრებით ეძებს — შეუვსებელი ველები ძებნაში ფართს მალავს.`, action: { labelKa: 'პასპორტის შევსება', href: `${edit}?step=passport` } });
    if (!hasPlan)
      advice.push({ key: 'no_floorplan', severity: 'low', messageKa: 'დაამატეთ ფართის ნახაზი — ზომებიან ნახაზი ეხმარება ბიზნესს, წინასწარ დაგეგმოს მოწყობა.', action: { labelKa: 'ნახაზის ატვირთვა', href: `${edit}?step=media` } });
    if (totals.views >= 40 && revealRatePct !== null && revealRatePct < 2)
      advice.push({ key: 'low_reveal_rate', severity: 'medium', messageKa: `ნახვიდან ზარებზე გადასვლა დაბალია (${revealRatePct}%). ხშირად მიზეზია ფასი, ფოტოები ან არასრული აღწერა.`, action: { labelKa: 'აღწერის გაუმჯობესება', href: `${edit}?step=describe` } });
    if (districtAvg.listings >= 3 && totals.views < districtAvg.views * 0.5)
      advice.push({ key: 'low_views', severity: 'medium', messageKa: `ნახვები ${districtAvg.districtName ?? 'რაიონის'} საშუალოზე 2+ ჯერ ნაკლებია (${totals.views} / ${districtAvg.views}). VIP სტატუსი განცხადებას ძებნის სათავეში აჩვენებს.`, action: { labelKa: 'VIP სტატუსი', href: '/account/listings' } });
    const order = { high: 0, medium: 1, low: 2 } as const;
    advice.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      listing: { id: l.id, slug: l.slug, title: l.title, status: l.status, photosCount, lastConfirmedAt: l.lastConfirmedAt?.toISOString() ?? null, publishedAt: l.publishedAt?.toISOString() ?? null, priceMinor: l.priceMinor, areaM2: l.areaM2 },
      days,
      series,
      totals,
      previousTotals,
      districtAvg,
      revealRatePct,
      offers: Number(counts?.offers ?? 0),
      viewings: Number(counts?.viewings ?? 0),
      price,
      passportCompletenessPct,
      advice,
    };
  }

  async explain(user: AuthUser, id: string) {
    const d = await this.listingDashboard(user, id, 30);
    if (!d.advice.length) return { text: 'განცხადება კარგ მდგომარეობაშია: ფასი, ფოტოები და პასპორტი შეესაბამება რეკომენდაციებს. შეინარჩუნეთ სტატუსის რეგულარული დადასტურება.', source: 'rules' as const };
    const context = `განცხადება: ${d.listing.title}. 30 დღე: ${d.totals.views} ნახვა, ${d.totals.reveals} ზარი, ${d.totals.saves} შენახვა. რაიონის საშუალო: ${d.districtAvg.views} ნახვა.`;
    const ai = await explainAdvice(this.ai, d.advice.map(({ key, severity, messageKa }) => ({ key, severity, messageKa })), context);
    if (ai) return { text: ai, source: 'ai' as const };
    const top = d.advice.slice(0, 2);
    return { text: `ყველაზე მნიშვნელოვანი: ${top.map((a) => a.messageKa).join(' ')}`, source: 'rules' as const };
  }

  async accountSummary(user: AuthUser): Promise<AccountSummaryDto> {
    const mine = sql`(${listings.ownerId} = ${user.id} OR ${listings.agentId} = ${user.id})`;
    const statusRows = await this.dbs.db
      .select({ status: listings.status, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(mine, isNull(listings.deletedAt)))
      .groupBy(listings.status);
    const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)]));
    const total = statusRows.reduce((a, r) => a + Number(r.n), 0);
    const [s30] = await this.dbs.db.execute<{ views: number; reveals: number; saves: number }>(sql`
      SELECT coalesce(sum(s.views),0)::int AS views, coalesce(sum(s.reveals),0)::int AS reveals, coalesce(sum(s.saves),0)::int AS saves
      FROM listing_stats_daily s JOIN listings l ON l.id = s.listing_id
      WHERE (l.owner_id = ${user.id} OR l.agent_id = ${user.id}) AND l.deleted_at IS NULL AND s.day >= (now() AT TIME ZONE 'Asia/Tbilisi')::date - 29`);
    const intervalDays = (await this.settings.number('liveness_interval_days')) || 12;
    const unconfirmed = await this.dbs.db.execute<{ id: string; slug: string; title: string; status: string; last_confirmed_at: string | null }>(sql`
      SELECT l.id, l.slug, l.title, l.status, l.last_confirmed_at FROM listings l
      WHERE (l.owner_id = ${user.id} OR l.agent_id = ${user.id}) AND l.deleted_at IS NULL
        AND (l.status = 'stale' OR (l.status = 'active' AND (l.last_confirmed_at IS NULL OR l.last_confirmed_at < now() - make_interval(days => ${intervalDays}))
             OR EXISTS (SELECT 1 FROM liveness_checks c WHERE c.listing_id = l.id AND c.result = 'pending' AND c.deleted_at IS NULL)))
      ORDER BY l.last_confirmed_at NULLS FIRST LIMIT 10`);
    const [o] = await this.dbs.db.execute<{ received: number; sent: number; awaiting: number }>(sql`
      SELECT count(*) FILTER (WHERE id = coalesce(root_offer_id, id) AND to_user_id = ${user.id})::int AS received,
             count(*) FILTER (WHERE id = coalesce(root_offer_id, id) AND from_user_id = ${user.id})::int AS sent,
             count(*) FILTER (WHERE status = 'pending' AND to_user_id = ${user.id})::int AS awaiting
      FROM offers WHERE deleted_at IS NULL AND (from_user_id = ${user.id} OR to_user_id = ${user.id})`);
    const upcoming = await this.dbs.db.execute<{ id: string; starts_at: string; title: string; user_id: string; mode: 'onsite' | 'video' }>(sql`
      SELECT v.id, v.starts_at, l.title, v.user_id, v.mode FROM viewings v JOIN listings l ON l.id = v.listing_id
      WHERE v.deleted_at IS NULL AND v.status IN ('requested','confirmed') AND v.starts_at >= now()
        AND (v.user_id = ${user.id} OR l.owner_id = ${user.id} OR l.agent_id = ${user.id})
      ORDER BY v.starts_at LIMIT 5`);
    const [fav] = await this.dbs.db.select({ n: sql<number>`count(*)::int` }).from(favorites).where(and(eq(favorites.userId, user.id), isNull(favorites.deletedAt)));
    const [ss] = await this.dbs.db.select({ n: sql<number>`count(*)::int` }).from(savedSearches).where(and(eq(savedSearches.userId, user.id), isNull(savedSearches.deletedAt)));
    const tp = await this.dbs.db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, user.id) });
    return {
      listings: { total, byStatus, views30d: Number(s30?.views ?? 0), reveals30d: Number(s30?.reveals ?? 0), saves30d: Number(s30?.saves ?? 0) },
      pending: {
        unconfirmedListings: unconfirmed.map((u) => ({ id: u.id, slug: u.slug, title: u.title, status: u.status, lastConfirmedAt: u.last_confirmed_at ? new Date(u.last_confirmed_at).toISOString() : null })),
        receivedOffers: Number(o?.received ?? 0),
        sentOffers: Number(o?.sent ?? 0),
        offersAwaitingMe: Number(o?.awaiting ?? 0),
        upcomingViewings: upcoming.map((v) => ({ id: v.id, startsAt: new Date(v.starts_at).toISOString(), title: v.title, myRole: v.user_id === user.id ? ('visitor' as const) : ('host' as const), mode: v.mode })),
        unreadMessages: await this.chat.unreadCount(user.id),
        rejectedListings: byStatus.rejected ?? 0,
        drafts: byStatus.draft ?? 0,
      },
      tenant: { favorites: Number(fav?.n ?? 0), savedSearches: Number(ss?.n ?? 0), offersSent: Number(o?.sent ?? 0), hasTenantProfile: !!tp },
    };
  }
}
