import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, districts, eq, plans, reportPurchases, sql } from '@lokacia/db';
import { formatMoney, formatNumber, type ReportPreview, type ReportPurchaseDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { STORAGE, type Storage } from '../../integrations/storage/storage';
import { GeoService } from '../geo/geo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { bars, createPdf, footer, heading, keyValues, paragraph, PDF_COLORS, table, toBuffer } from './pdf';

const CITY_KA: Record<string, string> = { tbilisi: 'თბილისი', batumi: 'ბათუმი', kutaisi: 'ქუთაისი', rustavi: 'რუსთავი' };

/** P23 paid part + V6 market reports: data aggregation and PDF rendering (Georgian font). */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger('Reports');
  constructor(
    private readonly dbs: DbService,
    private readonly geo: GeoService,
    private readonly tax: TaxonomyService,
    private readonly notify: NotificationsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  private async btName(slug: string | null | undefined) {
    if (!slug) return null;
    return (await this.tax.businessType(slug))?.nameKa ?? slug;
  }

  async preview(districtId: string, businessType?: string): Promise<ReportPreview> {
    const d = await this.dbs.db.query.districts.findFirst({ where: eq(districts.id, districtId) });
    if (!d) throw problems.notFound('რაიონი');
    const stats = (await this.geo.districtStats({ city: d.city, businessType })).find((s) => s.id === d.id);
    const comp = await this.dbs.db.execute<{ n: string }>(sql`
      SELECT count(*) AS n FROM pois p, districts d WHERE d.id = ${d.id} AND p.deleted_at IS NULL AND p.category = 'competitor'
        ${businessType ? sql`AND p.business_type = ${businessType}` : sql``} AND ST_Intersects(p.geom, d.geom)`);
    const sample = await this.dbs.db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM listings WHERE district_id = ${d.id} AND deleted_at IS NULL AND status IN ('active','stale','rented','sold')`);
    return {
      district: { id: d.id, name: d.nameKa, city: d.city },
      businessType: businessType ?? null,
      activeCount: stats?.activeCount ?? 0,
      avgPriceM2Minor: stats?.avgPriceM2Minor ?? (d.avgPriceM2Minor || null),
      competitorsCount: Number(comp[0]?.n ?? 0),
      sampleSize: Number(sample[0]?.n ?? 0),
    };
  }

  async mine(userId: string): Promise<ReportPurchaseDto[]> {
    const rows = await this.dbs.db.select().from(reportPurchases).where(eq(reportPurchases.userId, userId)).orderBy(desc(reportPurchases.createdAt));
    const out: ReportPurchaseDto[] = [];
    for (const r of rows) {
      if (r.status === 'pending') continue;
      const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, r.productKey) });
      const d = r.districtId ? await this.tax.districtById(r.districtId) : null;
      out.push({
        id: r.id, productKey: r.productKey, productName: plan?.nameKa ?? r.productKey, districtId: r.districtId, districtName: d?.nameKa ?? null, businessType: r.businessType,
        status: r.status, createdAt: r.createdAt.toISOString(), downloadUrl: `/api/v1/billing/reports/${r.id}/pdf`,
      });
    }
    return out;
  }

  async generatePurchase(purchaseId: string) {
    const r = await this.dbs.db.query.reportPurchases.findFirst({ where: eq(reportPurchases.id, purchaseId) });
    if (!r || !r.districtId) return;
    const buf = await this.districtReportPdf(r.districtId, r.businessType, r.productKey === 'report_pro');
    const key = `reports/${r.id}.pdf`;
    await this.storage.put(key, buf, 'application/pdf');
    await this.dbs.db.update(reportPurchases).set({ status: 'ready', url: `/api/v1/billing/reports/${r.id}/pdf`, payload: { storageKey: key, generatedAt: new Date().toISOString(), bytes: buf.length } }).where(eq(reportPurchases.id, r.id));
    const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, r.productKey) });
    await this.notify.notify({ userId: r.userId, template: 'report_ready', vars: { name: plan?.nameKa ?? 'რეპორტი' }, link: '/reports', channels: ['in_app'] });
  }

  async purchasePdf(userId: string, role: string, id: string) {
    const r = await this.dbs.db.query.reportPurchases.findFirst({ where: eq(reportPurchases.id, id) });
    if (!r || (r.userId !== userId && role !== 'admin')) throw problems.notFound('რეპორტი');
    if (r.status === 'pending') throw problems.conflict('რეპორტი ჯერ არ არის გადახდილი');
    const key = (r.payload as { storageKey?: string } | null)?.storageKey;
    const existing = key ? await this.storage.get(key) : null;
    if (existing) return existing;
    await this.generatePurchase(r.id);
    const again = await this.dbs.db.query.reportPurchases.findFirst({ where: eq(reportPurchases.id, id) });
    const k2 = (again?.payload as { storageKey?: string } | null)?.storageKey;
    const buf = k2 ? await this.storage.get(k2) : null;
    if (!buf) throw problems.notFound('რეპორტი');
    return buf;
  }

  /** Detailed location report for district × business type. `pro` adds foot traffic and location scores. */
  async districtReportPdf(districtId: string, businessType: string | null, pro: boolean) {
    const d = await this.dbs.db.query.districts.findFirst({ where: eq(districts.id, districtId) });
    if (!d) throw problems.notFound('რაიონი');
    const bt = businessType ?? undefined;
    const btName = await this.btName(businessType);
    const city = await this.geo.districtStats({ city: d.city, businessType: bt });
    const mine = city.find((s) => s.id === d.id);
    const cityAvg = (() => {
      const vals = city.map((c) => c.avgPriceM2Minor).filter((v): v is number => !!v);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    })();
    const poi = await this.dbs.db.execute<{ category: string; n: string }>(sql`
      SELECT p.category, count(*) AS n FROM pois p, districts d WHERE d.id = ${d.id} AND p.deleted_at IS NULL AND ST_Intersects(p.geom, d.geom)
        AND (p.category <> 'competitor' OR ${bt ?? null}::text IS NULL OR p.business_type = ${bt ?? null}) GROUP BY p.category`);
    const poiCount = (c: string) => Number(poi.find((p) => p.category === c)?.n ?? 0);
    const top = await this.dbs.db.execute<{ title: string; area_m2: number; price_minor: number; deal_type: string; location_score: number | null }>(sql`
      SELECT title, area_m2, price_minor, deal_type, location_score FROM listings
      WHERE district_id = ${d.id} AND status = 'active' AND deleted_at IS NULL ${bt ? sql`AND business_types @> ARRAY[${bt}]::text[]` : sql``}
      ORDER BY location_score DESC NULLS LAST, published_at DESC NULLS LAST LIMIT 8`);

    const doc = createPdf(pro ? 'ლოკაციის რეპორტი Pro' : 'ლოკაციის რეპორტი', `${CITY_KA[d.city] ?? d.city} · ${d.nameKa}${btName ? ` · ${btName}` : ''}`);
    heading(doc, 'ძირეული მაჩვენებლები');
    keyValues(doc, [
      ['აქტიური განცხადებები', formatNumber(mine?.activeCount ?? 0)],
      ['ვაკანტური ფართები (იჯარა)', formatNumber(mine?.vacancyCount ?? 0)],
      ['საშუალო იჯარა, 1 მ² / თვე', mine?.avgPriceM2Minor ? formatMoney(mine.avgPriceM2Minor) : '—'],
      ['ქალაქის საშუალო, 1 მ² / თვე', cityAvg ? formatMoney(cityAvg) : '—'],
      ['ფართის მედიანა', mine?.medianAreaM2 ? `${formatNumber(mine.medianAreaM2)} მ²` : '—'],
      ['კონკურენტები რაიონში', formatNumber(poiCount('competitor'))],
      ['ტრანსპორტის გაჩერებები', formatNumber(poiCount('transport'))],
      ['ბიზნეს-ცენტრები', formatNumber(poiCount('business_center'))],
      ['სკოლები', formatNumber(poiCount('school'))],
    ]);
    heading(doc, 'იჯარის ფასი 1 მ²-ზე რაიონების მიხედვით');
    bars(
      doc,
      city.filter((c) => c.avgPriceM2Minor).sort((a, b) => (b.avgPriceM2Minor ?? 0) - (a.avgPriceM2Minor ?? 0)).slice(0, 16).map((c) => ({ label: c.name, value: c.avgPriceM2Minor ?? 0, display: formatMoney(c.avgPriceM2Minor ?? 0) })),
    );
    if (pro) {
      const traffic = await this.dbs.db.execute<{ hour: number; avg: string }>(sql`
        SELECT t.hour, avg(t.count) AS avg FROM traffic_samples t JOIN listings l ON l.id = t.listing_id
        WHERE l.district_id = ${d.id} AND t.weekday BETWEEN 1 AND 5 GROUP BY t.hour ORDER BY t.hour`);
      if (traffic.length) {
        doc.addPage();
        heading(doc, 'ფეხით მოსიარულეთა ნაკადი (სამუშაო დღე, საათში)');
        bars(doc, traffic.filter((t) => t.hour >= 7 && t.hour <= 23).map((t) => ({ label: `${String(t.hour).padStart(2, '0')}:00`, value: Number(t.avg), display: formatNumber(Math.round(Number(t.avg))) })), { color: PDF_COLORS.blue });
      }
      const scores = await this.dbs.db.execute<{ avg: string | null; n: string }>(sql`
        SELECT avg(s.score) AS avg, count(*) AS n FROM location_scores s JOIN listings l ON l.id = s.listing_id
        WHERE l.district_id = ${d.id} ${bt ? sql`AND s.business_type = ${bt}` : sql``}`);
      heading(doc, 'ლოკაციის ქულა');
      paragraph(doc, scores[0]?.avg ? `საშუალო ქულა: ${Math.round(Number(scores[0].avg))}/100 (${scores[0].n} ფართი). ქულა ითვალისწინებს ნაკადს, კონკურენციას, ფასს, ტრანსპორტს და ტექნიკურ შესაბამისობას.` : 'ქულების მონაცემები ჯერ არ არის.');
    }
    heading(doc, 'საუკეთესო აქტიური ფართები');
    if (top.length) {
      table(
        doc,
        ['განცხადება', 'ფართი', 'ქულა', 'ფასი'],
        top.map((t) => [t.title, `${formatNumber(Number(t.area_m2))} მ²`, t.location_score != null ? String(t.location_score) : '—', formatMoney(t.price_minor)]),
        [260, 70, 50, 119],
      );
    } else paragraph(doc, 'ამ ფილტრით აქტიური ფართი ამ დროისთვის არ მოიძებნა.', { color: PDF_COLORS.stone });
    heading(doc, 'მეთოდოლოგია');
    paragraph(doc, 'მონაცემები ეფუძნება lokacia.ge-ზე გამოქვეყნებულ და მოდერირებულ განცხადებებს, OpenStreetMap-ის ობიექტებს და პარტნიორების ნაკადის მონაცემებს. ფასები — თვიური იჯარა ლარში, დღგ-ს ჩათვლით.', { size: 9, color: PDF_COLORS.stone });
    footer(doc);
    return toBuffer(doc);
  }

  /** V6: city market report for API clients (districts table + 12-month price index). */
  async marketReportPdf(city: string) {
    const stats = await this.geo.districtStats({ city });
    if (!stats.length) throw problems.notFound('ქალაქი');
    const index = await this.priceIndex({ city, months: 12 });
    const doc = createPdf('ბაზრის რეპორტი', `${CITY_KA[city] ?? city} · კომერციული ფართების იჯარა`);
    heading(doc, 'რაიონები');
    table(
      doc,
      ['რაიონი', 'აქტიური', 'ვაკანსია', 'მ² / თვე'],
      stats.map((s) => [s.name, formatNumber(s.activeCount), formatNumber(s.vacancyCount), s.avgPriceM2Minor ? formatMoney(s.avgPriceM2Minor) : '—']),
      [220, 80, 80, 119],
    );
    heading(doc, 'ფასების ინდექსი (საშუალო 1 მ²-ზე, თვე)');
    bars(doc, index.map((p) => ({ label: p.month, value: p.avgPriceM2Minor ?? 0, display: p.avgPriceM2Minor ? formatMoney(p.avgPriceM2Minor) : '—' })));
    footer(doc);
    return toBuffer(doc);
  }

  /** Monthly average asking rent per m² by publication month. */
  async priceIndex(q: { city?: string; districtId?: string; months?: number; businessType?: string }) {
    const months = Math.min(Math.max(q.months ?? 12, 1), 36);
    const rows = await this.dbs.db.execute<{ month: string; avg: string | null; n: string }>(sql`
      WITH m AS (SELECT to_char(date_trunc('month', now()) - (g || ' months')::interval, 'YYYY-MM') AS month FROM generate_series(0, ${months - 1}) g)
      SELECT m.month, avg(l.price_minor / NULLIF(l.area_m2, 0)) AS avg, count(l.id) AS n
      FROM m LEFT JOIN listings l ON to_char(coalesce(l.published_at, l.created_at), 'YYYY-MM') = m.month
        AND l.deleted_at IS NULL AND l.deal_type = 'rent' AND l.status IN ('active','stale','rented')
        ${q.city ? sql`AND l.city = ${q.city}` : sql``}
        ${q.districtId ? sql`AND l.district_id = ${q.districtId}` : sql``}
        ${q.businessType ? sql`AND l.business_types @> ARRAY[${q.businessType}]::text[]` : sql``}
      GROUP BY m.month ORDER BY m.month`);
    return rows.map((r) => ({ month: r.month, avgPriceM2Minor: r.avg ? Math.round(Number(r.avg)) : null, sampleSize: Number(r.n) }));
  }
}
