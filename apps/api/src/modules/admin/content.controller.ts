import { Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, asc, businessTypes, cmsPages, desc, districts, eq, isNull, plans } from '@lokacia/db';
import { ADMIN_SETTINGS, adminSettingsUpdateSchema, businessTypeSchema, cmsPageSchema, districtOverrideSchema, planUpdateSchema, type CmsPageDto } from '@lokacia/contracts';
import { Roles } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AppRequest } from '../../common/request';
import { SettingsService } from '../../common/settings.service';
import { ApiZodBody, ZBody } from '../../common/zod';
import { BillingService } from '../billing/billing.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

const uuid = z.string().uuid();
const SETTING_DEFAULTS: Record<string, unknown> = { billing_grace_hours: 72, finance_default_commission_pct: 1 };
const presentKeys = (req: AppRequest) => Object.keys((req.body as object) ?? {});
const pick = <T extends object>(body: T, keys: string[]) => Object.fromEntries(Object.entries(body).filter(([k]) => keys.includes(k))) as Partial<T>;

/** Phase 4: settings & prices, CMS (permits checklists, static pages), taxonomy editor. */
@ApiTags('admin')
@Roles('moderator')
@Controller('v1/admin')
export class AdminContentController {
  constructor(
    private readonly dbs: DbService,
    private readonly settings: SettingsService,
    private readonly billing: BillingService,
    private readonly tax: TaxonomyService,
  ) {}

  /* ---------------- settings & plans ---------------- */

  private async settingsResponse() {
    const all = await this.settings.all();
    const values = Object.fromEntries(Object.keys(ADMIN_SETTINGS).map((k) => [k, all[k] ?? SETTING_DEFAULTS[k] ?? null]));
    if (values.launch_promo_until === '') values.launch_promo_until = null;
    return { values, promoActive: await this.settings.promoActive(), plans: await this.billing.plans(true) };
  }

  @Get('settings')
  getSettings() {
    return this.settingsResponse();
  }

  @Patch('settings')
  @Roles('admin')
  @ApiZodBody(adminSettingsUpdateSchema)
  async updateSettings(@Req() req: AppRequest, @ZBody(adminSettingsUpdateSchema) body: z.infer<typeof adminSettingsUpdateSchema>) {
    for (const [k, v] of Object.entries(pick(body, presentKeys(req)))) {
      // jsonb NOT NULL: an empty string disables the launch promo
      await this.settings.set(k, v === null ? '' : v);
    }
    return this.settingsResponse();
  }

  @Patch('plans/:key')
  @Roles('admin')
  @ApiZodBody(planUpdateSchema)
  async updatePlan(@Param('key') key: string, @Req() req: AppRequest, @ZBody(planUpdateSchema) body: z.infer<typeof planUpdateSchema>) {
    const patch = pick(body, presentKeys(req));
    const [row] = await this.dbs.db.update(plans).set(patch).where(eq(plans.key, key)).returning();
    if (!row) throw problems.notFound('პაკეტი');
    return this.billing.planDto(row);
  }

  /* ---------------- CMS ---------------- */

  private cmsDto(p: typeof cmsPages.$inferSelect): CmsPageDto {
    return { id: p.id, kind: p.kind, slug: p.slug, businessTypeId: p.businessTypeId, locale: p.locale as 'ka' | 'en' | 'ru', title: p.title, bodyMd: p.bodyMd, published: p.published, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
  }

  @Get('cms')
  async cmsList(@Query('kind') kind?: string) {
    const k = kind === 'permits' || kind === 'static' ? kind : undefined;
    const rows = await this.dbs.db.select().from(cmsPages).where(and(isNull(cmsPages.deletedAt), k ? eq(cmsPages.kind, k) : undefined)).orderBy(asc(cmsPages.kind), asc(cmsPages.slug));
    return rows.map((r) => this.cmsDto(r));
  }

  private async page(id: string) {
    const p = await this.dbs.db.query.cmsPages.findFirst({ where: and(eq(cmsPages.id, uuid.parse(id)), isNull(cmsPages.deletedAt)) });
    if (!p) throw problems.notFound('გვერდი');
    return p;
  }

  @Get('cms/:id')
  async cmsGet(@Param('id') id: string) {
    return this.cmsDto(await this.page(id));
  }

  @Post('cms')
  @ApiZodBody(cmsPageSchema)
  async cmsCreate(@ZBody(cmsPageSchema) body: z.infer<typeof cmsPageSchema>) {
    const dup = await this.dbs.db.query.cmsPages.findFirst({ where: and(eq(cmsPages.kind, body.kind), eq(cmsPages.slug, body.slug), eq(cmsPages.locale, body.locale)) });
    if (dup && !dup.deletedAt) throw problems.conflict('ასეთი slug უკვე არსებობს');
    if (dup) {
      const [row] = await this.dbs.db.update(cmsPages).set({ ...body, businessTypeId: body.businessTypeId ?? null, deletedAt: null }).where(eq(cmsPages.id, dup.id)).returning();
      return this.cmsDto(row!);
    }
    const [row] = await this.dbs.db.insert(cmsPages).values({ ...body, businessTypeId: body.businessTypeId ?? null }).returning();
    return this.cmsDto(row!);
  }

  @Patch('cms/:id')
  @ApiZodBody(cmsPageSchema.partial())
  async cmsUpdate(@Param('id') id: string, @Req() req: AppRequest, @ZBody(cmsPageSchema.partial()) body: Partial<z.infer<typeof cmsPageSchema>>) {
    const p = await this.page(id);
    const patch = pick(body, presentKeys(req));
    const [row] = await this.dbs.db.update(cmsPages).set(patch).where(eq(cmsPages.id, p.id)).returning();
    return this.cmsDto(row!);
  }

  @Delete('cms/:id')
  async cmsDelete(@Param('id') id: string) {
    const p = await this.page(id);
    await this.dbs.db.update(cmsPages).set({ deletedAt: new Date(), published: false }).where(eq(cmsPages.id, p.id));
    return { ok: true, id: p.id };
  }

  /* ---------------- taxonomy ---------------- */

  @Get('business-types')
  businessTypes() {
    return this.dbs.db.select().from(businessTypes).where(isNull(businessTypes.deletedAt)).orderBy(asc(businessTypes.sort), asc(businessTypes.nameKa));
  }

  @Post('business-types')
  @ApiZodBody(businessTypeSchema)
  async btCreate(@ZBody(businessTypeSchema) body: z.infer<typeof businessTypeSchema>) {
    const dup = await this.dbs.db.query.businessTypes.findFirst({ where: eq(businessTypes.slug, body.slug) });
    if (dup && !dup.deletedAt) throw problems.conflict('ასეთი slug უკვე არსებობს');
    const values = { ...body, filterConfig: body.filterConfig as never };
    const [row] = dup
      ? await this.dbs.db.update(businessTypes).set({ ...values, deletedAt: null }).where(eq(businessTypes.id, dup.id)).returning()
      : await this.dbs.db.insert(businessTypes).values(values).returning();
    this.tax.invalidate();
    return row!;
  }

  @Patch('business-types/:id')
  @ApiZodBody(businessTypeSchema.partial())
  async btUpdate(@Param('id') id: string, @Req() req: AppRequest, @ZBody(businessTypeSchema.partial()) body: Partial<z.infer<typeof businessTypeSchema>>) {
    const patch = pick(body, presentKeys(req)) as Record<string, unknown>;
    const [row] = await this.dbs.db.update(businessTypes).set(patch).where(and(eq(businessTypes.id, uuid.parse(id)), isNull(businessTypes.deletedAt))).returning();
    if (!row) throw problems.notFound('ბიზნესის ტიპი');
    this.tax.invalidate();
    return row;
  }

  @Delete('business-types/:id')
  @Roles('admin')
  async btDelete(@Param('id') id: string) {
    const [row] = await this.dbs.db.update(businessTypes).set({ deletedAt: new Date() }).where(eq(businessTypes.id, uuid.parse(id))).returning({ id: businessTypes.id });
    if (!row) throw problems.notFound('ბიზნესის ტიპი');
    this.tax.invalidate();
    return { ok: true, id: row.id };
  }

  @Get('districts')
  districts(@Query('city') city?: string) {
    return this.dbs.db
      .select({ id: districts.id, city: districts.city, slug: districts.slug, nameKa: districts.nameKa, avgPriceM2Minor: districts.avgPriceM2Minor, avgPriceM2OverrideMinor: districts.avgPriceM2OverrideMinor, activeCount: districts.activeCount, vacancyCount: districts.vacancyCount })
      .from(districts)
      .where(city ? eq(districts.city, city) : undefined)
      .orderBy(asc(districts.city), asc(districts.nameKa));
  }

  @Patch('districts/:id')
  @ApiZodBody(districtOverrideSchema)
  async districtUpdate(@Param('id') id: string, @ZBody(districtOverrideSchema) body: z.infer<typeof districtOverrideSchema>) {
    const override = body.avgPriceM2OverrideMinor;
    const [row] = await this.dbs.db
      .update(districts)
      .set({ avgPriceM2OverrideMinor: override, ...(override != null ? { avgPriceM2Minor: override } : {}) })
      .where(eq(districts.id, uuid.parse(id)))
      .returning({ id: districts.id, city: districts.city, slug: districts.slug, nameKa: districts.nameKa, avgPriceM2Minor: districts.avgPriceM2Minor, avgPriceM2OverrideMinor: districts.avgPriceM2OverrideMinor, activeCount: districts.activeCount, vacancyCount: districts.vacancyCount });
    if (!row) throw problems.notFound('რაიონი');
    this.tax.invalidate();
    return row;
  }
}
void desc;
