import { Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { eq, sql, apiKeys } from '@lokacia/db';
import { apiKeyCreateSchema } from '@lokacia/contracts';
import { CurrentUser, NoImpersonation, Public, SkipAudit } from '../../../common/decorators';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import type { AppRequest, AuthUser } from '../../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { ReportsService } from '../../billing/reports.service';
import { GeoService } from '../../geo/geo.service';
import { InsightsService } from '../insights/insights.service';
import { ApiKeyGuard, RequireScope } from './api-key.guard';
import { ApiKeysService } from './api-keys.service';

const uuid = z.string().uuid();
const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'] as const;
const cityQuery = z.object({ city: z.enum(CITIES).default('tbilisi'), businessType: z.string().max(40).optional() });
const indexQuery = z.object({ city: z.enum(CITIES).default('tbilisi'), districtId: z.string().uuid().optional(), businessType: z.string().max(40).optional(), months: z.coerce.number().int().min(1).max(36).default(12) });
const listingQuery = z.object({ listingId: z.string().min(1).max(200) });
const scoreQuery = z.object({ listingId: z.string().max(200).optional(), city: z.enum(CITIES).default('tbilisi'), businessType: z.string().max(40).optional() });

@ApiTags('api-keys')
@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.keys.list(user);
  }

  @Post()
  @NoImpersonation()
  @ApiZodBody(apiKeyCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(apiKeyCreateSchema) body: z.infer<typeof apiKeyCreateSchema>) {
    return this.keys.create(user, body);
  }

  @Delete(':id')
  @NoImpersonation()
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.keys.revoke(user, uuid.parse(id));
  }

  @Get(':id/usage')
  usage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.keys.usage(user, uuid.parse(id));
  }
}

/** V6 public analytics API — authenticated by `x-api-key` (not cookies). */
@ApiTags('public-api')
@ApiHeader({ name: 'x-api-key', required: true })
@Public()
@SkipAudit()
@UseGuards(ApiKeyGuard)
@Controller('v1/public')
export class PublicApiController {
  constructor(
    private readonly geo: GeoService,
    private readonly reports: ReportsService,
    private readonly insights: InsightsService,
    private readonly keys: ApiKeysService,
    private readonly dbs: DbService,
  ) {}

  @Get('districts')
  @RequireScope('districts:read')
  async districts(@ZQuery(cityQuery) q: z.infer<typeof cityQuery>) {
    return { city: q.city, businessType: q.businessType ?? null, currency: 'GEL', items: await this.geo.districtStats({ city: q.city, businessType: q.businessType }) };
  }

  @Get('price-index')
  @RequireScope('prices:read')
  async priceIndex(@ZQuery(indexQuery) q: z.infer<typeof indexQuery>) {
    return { city: q.city, districtId: q.districtId ?? null, unit: 'tetri_per_m2_month', items: await this.reports.priceIndex(q) };
  }

  @Get('vacancy')
  @RequireScope('vacancy:read')
  async vacancy(@ZQuery(cityQuery) q: z.infer<typeof cityQuery>) {
    const stats = await this.geo.districtStats({ city: q.city, businessType: q.businessType });
    const stale = await this.dbs.db.execute<{ district_id: string; n: string }>(sql`
      SELECT district_id, count(*) AS n FROM listings WHERE city = ${q.city} AND status = 'stale' AND deleted_at IS NULL GROUP BY district_id`);
    return {
      city: q.city,
      items: stats.map((s) => ({ districtId: s.id, slug: s.slug, name: s.name, vacancyCount: s.vacancyCount, activeCount: s.activeCount, staleCount: Number(stale.find((x) => x.district_id === s.id)?.n ?? 0) })),
      totalVacancy: stats.reduce((a, s) => a + s.vacancyCount, 0),
    };
  }

  @Get('traffic')
  @RequireScope('traffic:read')
  traffic(@ZQuery(listingQuery) q: z.infer<typeof listingQuery>) {
    return this.insights.trafficFor(q.listingId);
  }

  @Get('scores')
  @RequireScope('scores:read')
  async scores(@ZQuery(scoreQuery) q: z.infer<typeof scoreQuery>) {
    if (q.listingId) return this.insights.scoreFor(q.listingId, q.businessType);
    const rows = await this.dbs.db.execute<{ id: string; slug: string; name_ka: string; avg: string | null; n: string }>(sql`
      SELECT d.id, d.slug, d.name_ka, avg(s.score) AS avg, count(s.id) AS n FROM districts d
      LEFT JOIN listings l ON l.district_id = d.id AND l.status = 'active' AND l.deleted_at IS NULL
      LEFT JOIN location_scores s ON s.listing_id = l.id ${q.businessType ? sql`AND s.business_type = ${q.businessType}` : sql``}
      WHERE d.city = ${q.city} GROUP BY d.id ORDER BY avg DESC NULLS LAST`);
    return { city: q.city, businessType: q.businessType ?? null, items: rows.map((r) => ({ districtId: r.id, slug: r.slug, name: r.name_ka, avgScore: r.avg ? Math.round(Number(r.avg)) : null, listings: Number(r.n) })) };
  }

  @Get('reports/market.pdf')
  @RequireScope('reports:read')
  async market(@ZQuery(cityQuery) q: z.infer<typeof cityQuery>, @Res() res: Response) {
    const buf = await this.reports.marketReportPdf(q.city);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="lokacia-market-${q.city}.pdf"`);
    res.send(buf);
  }

  @Get('usage')
  async usage(@Req() req: AppRequest) {
    const k = await this.dbs.db.query.apiKeys.findFirst({ where: eq(apiKeys.id, req.apiKey!.id) });
    if (!k) throw problems.unauthorized();
    return { key: { name: k.name, prefix: k.prefix, planKey: k.planKey, rateLimitPerMin: k.rateLimitPerMin, scopes: k.scopes }, ...(await this.keys.usageFor(k)) };
  }
}
void Query;
