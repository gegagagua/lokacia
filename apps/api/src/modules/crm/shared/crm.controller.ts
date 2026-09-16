import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, crmContacts, crmDeals, crmPipelines, desc, eq, isNull, listings, organizations, sql } from '@lokacia/db';
import { activityCreateSchema, CRM_PERMISSIONS, crmCan, type CrmSearchResult } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { ActivityService } from './activity.service';
import { Crm, Ctx, type CrmCtx } from './crm-access';

const activitiesQuery = z.object({ entity: z.enum(['contact', 'deal', 'listing']), entityId: z.string().uuid() });
const searchQuery = z.object({ q: z.string().trim().min(1).max(100) });

/** Cross-cutting CRM endpoints: workspace context, timeline, global search (command palette). */
@ApiTags('crm')
@Controller('v1/crm')
@Crm()
export class CrmSharedController {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
  ) {}

  /** Workspace context for the CRM shell: org branding, my role and permissions, default pipeline. */
  @Get('context')
  async context(@Ctx() ctx: CrmCtx) {
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, ctx.orgId) });
    if (!org) throw problems.notFound('ორგანიზაცია');
    const pipeline = await this.dbs.org(ctx.orgId, (tx) =>
      tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) }),
    );
    return {
      org: { id: org.id, name: org.name, slug: org.slug, type: org.type, logoUrl: org.logoUrl, brandColor: org.brandColor, leadDistribution: org.leadDistribution, plan: org.plan },
      role: ctx.role,
      userId: ctx.userId,
      permissions: CRM_PERMISSIONS.filter((p) => crmCan(ctx.role, p)),
      pipeline: pipeline ? { id: pipeline.id, name: pipeline.name, stages: pipeline.stages } : null,
    };
  }

  @Get('activities')
  list(@Ctx() ctx: CrmCtx, @ZQuery(activitiesQuery) q: z.infer<typeof activitiesQuery>) {
    return this.activities.list(ctx.orgId, q.entity, [q.entityId]);
  }

  @Post('activities')
  @ApiZodBody(activityCreateSchema)
  async create(@Ctx() ctx: CrmCtx, @ZBody(activityCreateSchema) body: z.infer<typeof activityCreateSchema>) {
    const row = await this.activities.log(ctx.orgId, { ...body, createdBy: ctx.userId });
    if (body.entity === 'contact') await this.touchContact(ctx.orgId, body.entityId);
    return row;
  }

  /** Command palette search (Cmd/Ctrl+K): contacts by trigram name or phone digits, deals, org listings. */
  @Get('search')
  async search(@Ctx() ctx: CrmCtx, @ZQuery(searchQuery) { q }: z.infer<typeof searchQuery>): Promise<CrmSearchResult> {
    const digits = q.replace(/\D/g, '');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return this.dbs.org(ctx.orgId, async (tx) => {
      const contactWhere = [
        isNull(crmContacts.deletedAt),
        isNull(crmContacts.mergedIntoId),
        digits.length >= 4
          ? sql`(array_to_string(${crmContacts.phones}, ' ') ~ ${digits.split('').join('\\D*')} OR ${crmContacts.name} ILIKE ${like})`
          : sql`(${crmContacts.name} ILIKE ${like} OR ${crmContacts.name} % ${q} OR ${crmContacts.company} ILIKE ${like})`,
      ];
      if (ctx.ownContactsOnly) contactWhere.push(eq(crmContacts.ownerAgentId, ctx.userId));
      const contacts = await tx
        .select({ id: crmContacts.id, name: crmContacts.name, phones: crmContacts.phones, type: crmContacts.type })
        .from(crmContacts)
        .where(and(...contactWhere))
        .orderBy(sql`similarity(${crmContacts.name}, ${q}) desc`)
        .limit(8);
      const dealWhere = [isNull(crmDeals.deletedAt), sql`${crmDeals.title} ILIKE ${like}`];
      if (ctx.ownDealsOnly) dealWhere.push(eq(crmDeals.agentId, ctx.userId));
      const deals = await tx.select({ id: crmDeals.id, title: crmDeals.title, stage: crmDeals.stage }).from(crmDeals).where(and(...dealWhere)).orderBy(desc(crmDeals.updatedAt)).limit(6);
      const ls = await tx
        .select({ id: listings.id, title: listings.title, address: listings.address, status: listings.status })
        .from(listings)
        .where(and(eq(listings.orgId, ctx.orgId), isNull(listings.deletedAt), sql`(${listings.title} ILIKE ${like} OR ${listings.address} ILIKE ${like})`))
        .limit(6);
      return { contacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phones[0] ?? null, type: c.type })), deals, listings: ls };
    });
  }

  async touchContact(orgId: string, contactId: string) {
    await this.dbs.org(orgId, (tx) => tx.update(crmContacts).set({ lastContactedAt: new Date() }).where(eq(crmContacts.id, contactId)));
  }
}
