import { Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, coBrokerShares, desc, eq, ilike, inArray, isNull, listings, memberships, ne, or, organizations, users } from '@lokacia/db';
import { cobrokerShareSchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { ENV, type Env } from '../../../config/env';
import { ListingReadService } from '../../listings/listing-read.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { assertCan, Crm, Ctx, type CrmCtx } from '../shared/crm-access';

type ShareRow = typeof coBrokerShares.$inferSelect;

/**
 * C22 co-brokering. `co_broker_shares` RLS lets both parties read (from_org or to_org) but only the source org write;
 * status changes by the target org therefore run in a system transaction with explicit `to_org_id = org` checks.
 */
@ApiTags('crm')
@Controller('v1/crm/cobroker')
@Crm()
export class CrmCobrokerController {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async present(rows: ShareRow[]) {
    const orgIds = [...new Set(rows.flatMap((r) => [r.fromOrgId, r.toOrgId]))];
    const orgs = orgIds.length ? await this.dbs.db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, phone: organizations.phone }).from(organizations).where(inArray(organizations.id, orgIds)) : [];
    const cards = await this.read.cards([...new Set(rows.map((r) => r.listingId))]);
    const byOrg = new Map(orgs.map((o) => [o.id, o]));
    const byListing = new Map(cards.map((c) => [c.id, c]));
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      splitPct: Number(r.splitPct),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      fromOrg: byOrg.get(r.fromOrgId) ?? null,
      toOrg: byOrg.get(r.toOrgId) ?? null,
      listing: byListing.get(r.listingId) ?? null,
    }));
  }

  @Get()
  async list(@Ctx() ctx: CrmCtx) {
    const rows = await this.dbs.org(ctx.orgId, (tx) => tx.select().from(coBrokerShares).where(isNull(coBrokerShares.deletedAt)).orderBy(desc(coBrokerShares.createdAt)));
    const all = await this.present(rows);
    return { outgoing: all.filter((s) => s.fromOrg?.id === ctx.orgId), incoming: all.filter((s) => s.toOrg?.id === ctx.orgId) };
  }

  /** Accepted incoming shares: listings of partner agencies this org may work with. */
  @Get('shared-listings')
  async shared(@Ctx() ctx: CrmCtx) {
    const rows = await this.dbs.org(ctx.orgId, (tx) =>
      tx.select().from(coBrokerShares).where(and(isNull(coBrokerShares.deletedAt), eq(coBrokerShares.toOrgId, ctx.orgId), eq(coBrokerShares.status, 'accepted'))),
    );
    return this.present(rows);
  }

  @Get('orgs')
  async orgs(@Ctx() ctx: CrmCtx, @Query('q') q?: string) {
    return this.dbs.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(and(isNull(organizations.deletedAt), eq(organizations.type, 'agency'), ne(organizations.id, ctx.orgId), q ? or(ilike(organizations.name, `%${q}%`), ilike(organizations.slug, `%${q}%`)) : undefined))
      .limit(20);
  }

  @Post()
  @ApiZodBody(cobrokerShareSchema)
  async create(@Ctx() ctx: CrmCtx, @ZBody(cobrokerShareSchema) body: z.infer<typeof cobrokerShareSchema>) {
    assertCan(ctx, 'listings.publish');
    const listing = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, body.listingId), isNull(listings.deletedAt)) });
    if (!listing || listing.orgId !== ctx.orgId) throw problems.badRequest('გაზიარება შესაძლებელია მხოლოდ თქვენ აგენტურის ფართის');
    if (body.toOrgId === ctx.orgId) throw problems.badRequest('საკუთარ აგენტურას გაზიარება შეუძლებელია');
    const target = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, body.toOrgId), isNull(organizations.deletedAt)) });
    if (!target) throw problems.notFound('ორგანიზაცია');
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      const dup = await tx.query.coBrokerShares.findFirst({
        where: and(eq(coBrokerShares.listingId, body.listingId), eq(coBrokerShares.toOrgId, body.toOrgId), inArray(coBrokerShares.status, ['proposed', 'accepted']), isNull(coBrokerShares.deletedAt)),
      });
      if (dup) throw problems.conflict('ეს ფართი ამ აგენტურას უკვე გაზიარებულია');
      const [r] = await tx.insert(coBrokerShares).values({ listingId: body.listingId, fromOrgId: ctx.orgId, toOrgId: body.toOrgId, splitPct: body.splitPct, note: body.note ?? null, status: 'proposed' }).returning();
      return r!;
    });
    const from = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, ctx.orgId) });
    const managers = await this.dbs.db
      .select({ userId: memberships.userId })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, body.toOrgId), eq(memberships.role, 'manager'), eq(memberships.active, true), isNull(memberships.deletedAt)));
    for (const m of managers) {
      await this.notify.notify({ userId: m.userId, template: 'crm_cobroker_share', vars: { org: from?.name ?? '', title: listing.title, split: body.splitPct }, link: `${this.env.CRM_URL}/cobroker`, channels: ['in_app'] });
    }
    return (await this.present([row]))[0];
  }

  private async targetDecision(ctx: CrmCtx, id: string, status: 'accepted' | 'declined') {
    if (ctx.role !== 'manager' && ctx.role !== 'admin') throw problems.forbidden('გაზიარების მიღება — მხოლოდ მენეჯერი');
    const row = await this.dbs.system(async (tx) => {
      const s = await tx.query.coBrokerShares.findFirst({ where: and(eq(coBrokerShares.id, id), eq(coBrokerShares.toOrgId, ctx.orgId), isNull(coBrokerShares.deletedAt)) });
      if (!s) throw problems.notFound('გაზიარება');
      if (s.status !== 'proposed') throw problems.invalidTransition(s.status, status);
      const [r] = await tx.update(coBrokerShares).set({ status }).where(eq(coBrokerShares.id, id)).returning();
      return r!;
    });
    return (await this.present([row]))[0];
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.targetDecision(ctx, id, 'accepted');
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.targetDecision(ctx, id, 'declined');
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    assertCan(ctx, 'listings.publish');
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      const s = await tx.query.coBrokerShares.findFirst({ where: and(eq(coBrokerShares.id, id), eq(coBrokerShares.fromOrgId, ctx.orgId), isNull(coBrokerShares.deletedAt)) });
      if (!s) throw problems.notFound('გაზიარება');
      if (s.status === 'revoked' || s.status === 'declined') throw problems.invalidTransition(s.status, 'revoked');
      const [r] = await tx.update(coBrokerShares).set({ status: 'revoked' }).where(eq(coBrokerShares.id, id)).returning();
      return r!;
    });
    return (await this.present([row]))[0];
  }
}
