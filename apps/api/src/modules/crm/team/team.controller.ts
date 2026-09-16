import { Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, crmContacts, crmDeals, crmPipelines, crmTasks, eq, gte, inArray, isNull, lt, memberships, organizations, sql, users } from '@lokacia/db';
import { LEAD_DISTRIBUTION_MODES, teamMemberUpdateSchema, type TeamMemberStats } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { LeadDistributionService } from './lead-distribution.service';

const settingsSchema = z.object({ leadDistribution: z.enum(LEAD_DISTRIBUTION_MODES) });

/** C17 team & permissions. */
@ApiTags('crm-team')
@Controller('v1/crm/team')
@Crm()
export class TeamController {
  constructor(
    private readonly dbs: DbService,
    private readonly distribution: LeadDistributionService,
  ) {}

  @Get()
  async members(@Ctx() ctx: CrmCtx): Promise<{ leadDistribution: string; members: TeamMemberStats[] }> {
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, ctx.orgId) });
    const rows = await this.dbs.db
      .select({ m: memberships, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, ctx.orgId), isNull(memberships.deletedAt)));
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const stats = await this.dbs.org(ctx.orgId, async (tx) => {
      const p = await tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) });
      const open = p?.stages.filter((s) => s.kind === 'open').map((s) => s.key) ?? [];
      const won = p?.stages.filter((s) => s.kind === 'won').map((s) => s.key) ?? [];
      const contacts = await tx.select({ id: crmContacts.ownerAgentId, n: sql<number>`count(*)::int` }).from(crmContacts).where(and(isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId))).groupBy(crmContacts.ownerAgentId);
      const openDeals = open.length ? await tx.select({ id: crmDeals.agentId, n: sql<number>`count(*)::int` }).from(crmDeals).where(and(isNull(crmDeals.deletedAt), inArray(crmDeals.stage, open))).groupBy(crmDeals.agentId) : [];
      const wonMonth = won.length ? await tx.select({ id: crmDeals.agentId, n: sql<number>`count(*)::int` }).from(crmDeals).where(and(isNull(crmDeals.deletedAt), inArray(crmDeals.stage, won), gte(crmDeals.closedAt, monthStart))).groupBy(crmDeals.agentId) : [];
      const overdue = await tx.select({ id: crmTasks.assigneeId, n: sql<number>`count(*)::int` }).from(crmTasks).where(and(isNull(crmTasks.deletedAt), isNull(crmTasks.doneAt), lt(crmTasks.dueAt, new Date()))).groupBy(crmTasks.assigneeId);
      const map = (r: { id: string | null; n: number }[]) => new Map(r.map((x) => [x.id, x.n]));
      return { contacts: map(contacts), openDeals: map(openDeals), wonMonth: map(wonMonth), overdue: map(overdue) };
    });
    return {
      leadDistribution: org?.leadDistribution ?? 'round_robin',
      members: rows.map(({ m, name, phone, avatarUrl }) => ({
        id: m.id,
        userId: m.userId,
        name,
        phone,
        invitedPhone: m.invitedPhone,
        avatarUrl,
        role: m.role,
        active: m.active,
        acceptedAt: m.acceptedAt?.toISOString() ?? null,
        districtIds: m.districtIds,
        stats: {
          contacts: (m.userId && stats.contacts.get(m.userId)) || 0,
          openDeals: (m.userId && stats.openDeals.get(m.userId)) || 0,
          wonThisMonth: (m.userId && stats.wonMonth.get(m.userId)) || 0,
          overdueTasks: (m.userId && stats.overdue.get(m.userId)) || 0,
        },
      })),
    };
  }

  @Patch('settings')
  @Crm('team.manage')
  @ApiZodBody(settingsSchema)
  async settings(@Ctx() ctx: CrmCtx, @ZBody(settingsSchema) body: z.infer<typeof settingsSchema>) {
    const [row] = await this.dbs.db.update(organizations).set({ leadDistribution: body.leadDistribution }).where(eq(organizations.id, ctx.orgId)).returning({ leadDistribution: organizations.leadDistribution });
    return row;
  }

  @Patch('members/:id')
  @Crm('team.manage')
  @ApiZodBody(teamMemberUpdateSchema)
  async update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(teamMemberUpdateSchema) body: z.infer<typeof teamMemberUpdateSchema>) {
    const m = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.id, id), eq(memberships.orgId, ctx.orgId), isNull(memberships.deletedAt)) });
    if (!m) throw problems.notFound('წევრი');
    if (m.userId === ctx.userId && ((body.role && body.role !== 'manager') || body.active === false)) throw problems.badRequest('საკუთარ თავს მენეჯერის როლს ჩამორთმევა შეუძლებელია');
    const [row] = await this.dbs.db.update(memberships).set(body).where(eq(memberships.id, id)).returning();
    return row;
  }

  @Post('distribute/:contactId')
  @HttpCode(200)
  @Crm('team.manage')
  distribute(@Ctx() ctx: CrmCtx, @Param('contactId') contactId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(contactId)) throw problems.notFound('კონტაქტი');
    return this.distribution.distribute(ctx.orgId, contactId, { force: true });
  }
}
