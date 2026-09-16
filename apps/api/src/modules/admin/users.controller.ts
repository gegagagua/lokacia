import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { and, auditLog, count, desc, eq, ilike, isNotNull, isNull, listings, memberships, or, organizations, sessions, sql, subscriptions, users } from '@lokacia/db';
import {
  adminBanSchema, adminOrgUpdateSchema, adminOrgsQuerySchema, adminRoleSchema, adminUsersQuerySchema, decodeCursor, encodeCursor, type AdminOrgDetail, type AdminOrgRow, type AdminUserDetail,
  type AdminUserRow,
} from '@lokacia/contracts';
import { ENV, type Env } from '../../config/env';
import { ClientIp, CurrentUser, Roles } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AppRequest, AuthUser } from '../../common/request';
import { TokensService } from '../../common/tokens.service';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { AuthService } from '../auth/auth.service';
import { auditFor } from './moderation.controller';

const uuid = z.string().uuid();
type UserRow = typeof users.$inferSelect;

@ApiTags('admin')
@Roles('moderator')
@Controller('v1/admin')
export class AdminUsersController {
  constructor(
    private readonly dbs: DbService,
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async listingsCount(userId: string) {
    const r = await this.dbs.db.select({ n: count() }).from(listings).where(and(eq(listings.ownerId, userId), isNull(listings.deletedAt)));
    return r[0]?.n ?? 0;
  }

  private async row(u: UserRow): Promise<AdminUserRow> {
    return { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, bannedAt: u.bannedAt?.toISOString() ?? null, banReason: u.banReason, createdAt: u.createdAt.toISOString(), lastSeenAt: u.lastSeenAt?.toISOString() ?? null, listingsCount: await this.listingsCount(u.id) };
  }

  private async user(id: string) {
    const u = await this.dbs.db.query.users.findFirst({ where: and(eq(users.id, uuid.parse(id)), isNull(users.deletedAt)) });
    if (!u) throw problems.notFound('მომხმარებელი');
    return u;
  }

  @Get('users')
  async users(@ZQuery(adminUsersQuerySchema) q: z.infer<typeof adminUsersQuerySchema>) {
    const c = decodeCursor<{ at: string; id: string }>(q.cursor);
    const like = q.q ? `%${q.q.replace(/[%_]/g, '')}%` : null;
    const base = and(
      isNull(users.deletedAt),
      like ? or(ilike(users.name, like), ilike(users.phone, like), ilike(users.email, like)) : undefined,
      q.role ? eq(users.role, q.role) : undefined,
      q.banned === 'true' ? isNotNull(users.bannedAt) : q.banned === 'false' ? isNull(users.bannedAt) : undefined,
    );
    const rows = await this.dbs.db
      .select()
      .from(users)
      .where(and(base, c ? sql`(${users.createdAt}, ${users.id}) < (${c.at}::timestamptz, ${c.id}::uuid)` : undefined))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const total = await this.dbs.db.select({ n: count() }).from(users).where(base);
    const last = page.at(-1);
    return { items: await Promise.all(page.map((u) => this.row(u))), nextCursor: rows.length > q.limit && last ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id }) : null, total: total[0]?.n ?? 0 };
  }

  @Get('users/:id')
  async detail(@Param('id') id: string): Promise<AdminUserDetail> {
    const u = await this.user(id);
    const orgs = await this.dbs.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.userId, u.id), eq(memberships.active, true), isNull(memberships.deletedAt)));
    const active = await this.dbs.db.select({ n: count() }).from(sessions).where(and(eq(sessions.userId, u.id), isNull(sessions.revokedAt), sql`${sessions.expiresAt} > now()`));
    const ls = await this.dbs.db.select({ id: listings.id, slug: listings.slug, title: listings.title, status: listings.status }).from(listings).where(and(eq(listings.ownerId, u.id), isNull(listings.deletedAt))).orderBy(desc(listings.updatedAt)).limit(50);
    const subs = await this.dbs.db.select().from(subscriptions).where(eq(subscriptions.userId, u.id)).orderBy(desc(subscriptions.createdAt));
    return {
      ...(await this.row(u)), orgs, activeSessions: active[0]?.n ?? 0, verifiedAt: u.verifiedAt?.toISOString() ?? null, listings: ls,
      subscriptions: subs.map((s) => ({ id: s.id, planKey: s.planKey, status: s.status, periodEnd: s.periodEnd?.toISOString() ?? null })),
      audit: await auditFor(this.dbs, and(or(eq(auditLog.actorId, u.id), eq(auditLog.entityId, u.id))), 50),
    };
  }

  @Patch('users/:id/role')
  @Roles('admin')
  @ApiZodBody(adminRoleSchema)
  async role(@CurrentUser() me: AuthUser, @Param('id') id: string, @ZBody(adminRoleSchema) body: z.infer<typeof adminRoleSchema>) {
    const u = await this.user(id);
    if (u.id === me.id) throw problems.conflict('საკუთარი როლის შეცვლა შეუძლებელია');
    const [row] = await this.dbs.db.update(users).set({ role: body.role }).where(eq(users.id, u.id)).returning();
    // role lives in access tokens: force re-login
    await this.auth.logoutAll(u.id);
    return this.row(row!);
  }

  @Post('users/:id/ban')
  @HttpCode(200)
  @ApiZodBody(adminBanSchema)
  async ban(@CurrentUser() me: AuthUser, @Param('id') id: string, @ZBody(adminBanSchema) body: z.infer<typeof adminBanSchema>) {
    const u = await this.user(id);
    if (u.id === me.id) throw problems.conflict('საკუთარი ანგარიშის ბლოკირება შეუძლებელია');
    if (u.role === 'admin' || (u.role === 'moderator' && me.role !== 'admin')) throw problems.forbidden('ამ მომხმარებლის ბლოკირება შეუძლებელია');
    const [row] = await this.dbs.db.update(users).set({ bannedAt: new Date(), banReason: body.reason }).where(eq(users.id, u.id)).returning();
    await this.auth.logoutAll(u.id);
    return this.row(row!);
  }

  @Post('users/:id/unban')
  @HttpCode(200)
  async unban(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const u = await this.user(id);
    if (u.role === 'admin' || (u.role === 'moderator' && me.role !== 'admin')) throw problems.forbidden('ამ მომხმარებლის განბლოკვა შეუძლებელია');
    const [row] = await this.dbs.db.update(users).set({ bannedAt: null, banReason: null }).where(eq(users.id, u.id)).returning();
    return this.row(row!);
  }

  /** Admin acts as the user; the session carries impersonator_id so audit_log records the real actor. */
  @Post('users/:id/impersonate')
  @Roles('admin')
  @HttpCode(200)
  async impersonate(@CurrentUser() me: AuthUser, @Param('id') id: string, @ClientIp() ip: string, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (me.impersonatorId) throw problems.conflict('ჯერ გამოდით მიმდინარე ადმინის რეჟიმიდან');
    const u = await this.user(id);
    if (u.id === me.id || u.role === 'admin' || u.role === 'moderator') throw problems.forbidden('ადმინის ანგარიშზე შესვლა შეუძლებელია');
    if (u.bannedAt) throw problems.conflict('მომხმარებელი დაბლოკილია');
    const issued = await this.auth.issue(u.id, u.role, { ip, userAgent: req.headers['user-agent'] }, undefined, me.id);
    this.tokens.setAuthCookies(res, issued.access, issued.refresh);
    return { ok: true, userId: u.id, redirectUrl: `${this.env.APP_URL}/account` };
  }

  /* ---------------- organizations ---------------- */

  private async orgRow(o: typeof organizations.$inferSelect): Promise<AdminOrgRow> {
    const m = await this.dbs.db.select({ n: count() }).from(memberships).where(and(eq(memberships.orgId, o.id), eq(memberships.active, true), isNull(memberships.deletedAt)));
    const l = await this.dbs.db.select({ n: count() }).from(listings).where(and(eq(listings.orgId, o.id), isNull(listings.deletedAt)));
    return { id: o.id, name: o.name, slug: o.slug, type: o.type, plan: o.plan, verified: o.verified, membersCount: m[0]?.n ?? 0, listingsCount: l[0]?.n ?? 0, createdAt: o.createdAt.toISOString() };
  }

  @Get('orgs')
  async orgs(@ZQuery(adminOrgsQuerySchema) q: z.infer<typeof adminOrgsQuerySchema>) {
    const c = decodeCursor<{ at: string; id: string }>(q.cursor);
    const like = q.q ? `%${q.q.replace(/[%_]/g, '')}%` : null;
    const base = and(isNull(organizations.deletedAt), like ? or(ilike(organizations.name, like), ilike(organizations.slug, like)) : undefined, q.type ? eq(organizations.type, q.type) : undefined);
    const rows = await this.dbs.db
      .select()
      .from(organizations)
      .where(and(base, c ? sql`(${organizations.createdAt}, ${organizations.id}) < (${c.at}::timestamptz, ${c.id}::uuid)` : undefined))
      .orderBy(desc(organizations.createdAt), desc(organizations.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const total = await this.dbs.db.select({ n: count() }).from(organizations).where(base);
    const last = page.at(-1);
    return { items: await Promise.all(page.map((o) => this.orgRow(o))), nextCursor: rows.length > q.limit && last ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id }) : null, total: total[0]?.n ?? 0 };
  }

  private async org(id: string) {
    const o = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, uuid.parse(id)), isNull(organizations.deletedAt)) });
    if (!o) throw problems.notFound('ორგანიზაცია');
    return o;
  }

  @Get('orgs/:id')
  async orgDetail(@Param('id') id: string): Promise<AdminOrgDetail> {
    const o = await this.org(id);
    const members = await this.dbs.db
      .select({ id: memberships.id, userId: memberships.userId, name: users.name, phone: sql<string | null>`coalesce(${users.phone}, ${memberships.invitedPhone})`, role: memberships.role, active: memberships.active })
      .from(memberships)
      .leftJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, o.id), isNull(memberships.deletedAt)));
    const subs = await this.dbs.db.select().from(subscriptions).where(eq(subscriptions.orgId, o.id)).orderBy(desc(subscriptions.createdAt));
    return { ...(await this.orgRow(o)), phone: o.phone, email: o.email, members, subscriptions: subs.map((s) => ({ id: s.id, planKey: s.planKey, status: s.status, seats: s.seats, periodEnd: s.periodEnd?.toISOString() ?? null })) };
  }

  @Patch('orgs/:id')
  @Roles('admin')
  @ApiZodBody(adminOrgUpdateSchema)
  async orgUpdate(@Param('id') id: string, @Req() req: AppRequest, @ZBody(adminOrgUpdateSchema) body: z.infer<typeof adminOrgUpdateSchema>) {
    const o = await this.org(id);
    const keys = Object.keys((req.body as object) ?? {});
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => keys.includes(k)));
    if (!Object.keys(patch).length) return this.orgRow(o);
    const [row] = await this.dbs.db.update(organizations).set(patch).where(eq(organizations.id, o.id)).returning();
    return this.orgRow(row!);
  }
}

/** Separate controller without @Roles: the impersonated session has the target user's role. */
@ApiTags('admin')
@Controller('v1/admin/impersonation')
export class ImpersonationController {
  constructor(
    private readonly dbs: DbService,
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('stop')
  @HttpCode(200)
  async stop(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (!user.impersonatorId) throw problems.badRequest('ადმინის რეჟიმი არ არის აქტიური');
    if (user.sessionId) await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, user.sessionId));
    const admin = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.impersonatorId) });
    if (!admin || admin.bannedAt || admin.role !== 'admin') {
      this.tokens.clearAuthCookies(res);
      return { ok: true, redirectUrl: `${this.env.ADMIN_URL}/login` };
    }
    const issued = await this.auth.issue(admin.id, admin.role, { ip, userAgent: req.headers['user-agent'] });
    this.tokens.setAuthCookies(res, issued.access, issued.refresh);
    return { ok: true, redirectUrl: `${this.env.ADMIN_URL}/users/${user.id}` };
  }
}
