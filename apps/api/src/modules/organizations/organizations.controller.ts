import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, eq, isNull, memberships, organizations, users, crmPipelines, sql } from '@lokacia/db';
import { orgCreateSchema, orgInviteSchema, orgRoleChangeSchema, slugify } from '@lokacia/contracts';
import { CurrentUser, Org, OrgScoped, Public } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AuthUser, OrgCtx } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { NotificationsService } from '../notifications/notifications.service';

const orgUpdateSchema = orgCreateSchema.partial().extend({
  logoUrl: z.string().nullish(),
  website: z.string().url().nullish(),
  address: z.string().max(200).nullish(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  leadDistribution: z.enum(['round_robin', 'district', 'manual']).optional(),
});
const memberUpdateSchema = orgRoleChangeSchema.partial().extend({ districtIds: z.array(z.string().uuid()).optional(), active: z.boolean().optional() });

export const DEFAULT_PIPELINE = [
  { key: 'lead', name: 'ლიდი', kind: 'open' as const },
  { key: 'viewing', name: 'ჩვენება', kind: 'open' as const },
  { key: 'offer', name: 'შეთავაზება', kind: 'open' as const },
  { key: 'contract', name: 'ხელშეკრულება', kind: 'open' as const },
  { key: 'won', name: 'მოგებული', kind: 'won' as const },
  { key: 'lost', name: 'წაგებული', kind: 'lost' as const },
];

@ApiTags('organizations')
@Controller('v1/orgs')
export class OrganizationsController {
  constructor(
    private readonly dbs: DbService,
    private readonly notify: NotificationsService,
  ) {}

  @Post()
  @ApiZodBody(orgCreateSchema)
  async create(@CurrentUser() user: AuthUser, @ZBody(orgCreateSchema) body: z.infer<typeof orgCreateSchema>) {
    let slug = slugify(body.name) || 'org';
    if (await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.slug, slug) })) slug = `${slug}-${Date.now().toString(36)}`;
    return this.dbs.db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({ ...body, slug }).returning();
      await tx.insert(memberships).values({ orgId: org!.id, userId: user.id, role: 'manager', acceptedAt: new Date() });
      const u = await tx.query.users.findFirst({ where: eq(users.id, user.id) });
      if (u && (u.role === 'user' || u.role === 'broker')) await tx.update(users).set({ role: body.type === 'developer' ? 'developer' : 'agency_manager' }).where(eq(users.id, user.id));
      if (body.type === 'agency') {
        await tx.execute(sql`select set_config('app.org_id', ${org!.id}, true)`);
        await tx.insert(crmPipelines).values({ orgId: org!.id, name: 'ძირითადი', stages: DEFAULT_PIPELINE, isDefault: true });
      }
      return org;
    });
  }

  @Public()
  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string) {
    const org = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.slug, slug), isNull(organizations.deletedAt)) });
    if (!org) throw problems.notFound('ორგანიზაცია');
    const { rrCursor: _r, plan: _p, ...pub } = org;
    return pub;
  }

  @Get('current')
  @OrgScoped()
  async current(@Org() org: OrgCtx) {
    const row = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, org.id) });
    return { ...row, myRole: org.role };
  }

  @Patch('current')
  @OrgScoped('manager')
  @ApiZodBody(orgUpdateSchema)
  async update(@Org() org: OrgCtx, @ZBody(orgUpdateSchema) body: z.infer<typeof orgUpdateSchema>) {
    const [row] = await this.dbs.db.update(organizations).set(body).where(eq(organizations.id, org.id)).returning();
    return row;
  }

  @Get('current/members')
  @OrgScoped()
  members(@Org() org: OrgCtx) {
    return this.dbs.db
      .select({ id: memberships.id, userId: memberships.userId, role: memberships.role, invitedPhone: memberships.invitedPhone, acceptedAt: memberships.acceptedAt, active: memberships.active, districtIds: memberships.districtIds, name: users.name, phone: users.phone, avatarUrl: users.avatarUrl, slug: users.slug })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, org.id), isNull(memberships.deletedAt)));
  }

  @Post('current/invites')
  @OrgScoped('manager')
  @ApiZodBody(orgInviteSchema)
  async invite(@Org() org: OrgCtx, @ZBody(orgInviteSchema) body: z.infer<typeof orgInviteSchema>) {
    const existingUser = await this.dbs.db.query.users.findFirst({ where: eq(users.phone, body.phone) });
    if (existingUser) {
      const dup = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.orgId, org.id), eq(memberships.userId, existingUser.id), isNull(memberships.deletedAt)) });
      if (dup) throw problems.conflict('მომხმარებელი უკვე გუნდის წევრია');
      const [m] = await this.dbs.db.insert(memberships).values({ orgId: org.id, userId: existingUser.id, role: body.role, acceptedAt: new Date() }).returning();
      if (existingUser.role === 'user') await this.dbs.db.update(users).set({ role: body.role === 'assistant' ? 'agency_assistant' : 'broker' }).where(eq(users.id, existingUser.id));
      await this.notify.notify({ userId: existingUser.id, template: 'generic', vars: { title: 'თქვენ დაგამატეს გუნდში', body: 'შედით CRM-ში, რომ დაიწყოთ მუშავება.' }, channels: ['in_app', 'sms'] });
      return m;
    }
    const [m] = await this.dbs.db.insert(memberships).values({ orgId: org.id, invitedPhone: body.phone, role: body.role }).returning();
    await this.notify.notify({ template: 'generic', vars: { title: 'მოწვევა lokacia.ge CRM-ში', body: 'შედით ამ ნომრით, რომ შეუერთდეთ გუნდს.' }, channels: ['sms'], to: { sms: body.phone }, link: '/login' });
    return m;
  }

  @Patch('current/members/:id')
  @OrgScoped('manager')
  @ApiZodBody(memberUpdateSchema)
  async updateMember(@Org() org: OrgCtx, @Param('id') id: string, @ZBody(memberUpdateSchema) body: z.infer<typeof memberUpdateSchema>) {
    const [m] = await this.dbs.db.update(memberships).set(body).where(and(eq(memberships.id, id), eq(memberships.orgId, org.id))).returning();
    if (!m) throw problems.notFound('წევრი');
    return m;
  }

  @Delete('current/members/:id')
  @OrgScoped('manager')
  @HttpCode(200)
  async removeMember(@Org() org: OrgCtx, @CurrentUser() user: AuthUser, @Param('id') id: string) {
    const m = await this.dbs.db.query.memberships.findFirst({ where: and(eq(memberships.id, id), eq(memberships.orgId, org.id)) });
    if (!m) throw problems.notFound('წევრი');
    if (m.userId === user.id) throw problems.badRequest('საკუთარ თავს წაშლა შეუძლებელია');
    await this.dbs.db.update(memberships).set({ deletedAt: new Date(), active: false }).where(eq(memberships.id, id));
    return { ok: true };
  }
}
