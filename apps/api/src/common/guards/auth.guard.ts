import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, isNull, memberships, organizations } from '@lokacia/db';
import type { OrgRole, Role } from '@lokacia/contracts';
import { IS_PUBLIC, ORG_ROLES_KEY, ORG_SCOPED, ROLES_KEY } from '../decorators';
import { problems } from '../problem';
import type { AppRequest } from '../request';
import { ACCESS_COOKIE, TokensService } from '../tokens.service';
import { DbService } from '../db.service';

/**
 * Global guard: authenticates from the access cookie or Bearer header, then enforces
 * @Public, @Roles and @OrgScoped. Default is "login required".
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly dbs: DbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const targets = [ctx.getHandler(), ctx.getClass()];

    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const raw = bearer ?? (req.cookies?.[ACCESS_COOKIE] as string | undefined);
    const payload = raw ? this.tokens.verifyAccess(raw) : null;
    if (payload) req.user = { id: payload.sub, role: payload.role, impersonatorId: payload.imp ?? null, sessionId: payload.sid };

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    if (!req.user) {
      if (isPublic) return true;
      throw problems.unauthorized();
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (roles?.length && req.user.role !== 'admin' && !roles.includes(req.user.role)) throw problems.forbidden();

    if (this.reflector.getAllAndOverride<boolean>(ORG_SCOPED, targets)) {
      const orgId = (req.headers['x-org-id'] as string | undefined) ?? (req.query.orgId as string | undefined);
      if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) throw problems.badRequest('x-org-id header is required');
      const orgRoles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, targets);
      if (req.user.role === 'admin') {
        const org = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)) });
        if (!org) throw problems.notFound('ორგანიზაცია');
        req.org = { id: orgId, role: 'admin' };
        return true;
      }
      const m = await this.dbs.db.query.memberships.findFirst({
        where: and(eq(memberships.orgId, orgId), eq(memberships.userId, req.user.id), eq(memberships.active, true), isNull(memberships.deletedAt)),
      });
      if (!m) throw problems.forbidden('თქვენ არ ხართ ამ ორგანიზაციის წევრი');
      if (orgRoles?.length && !orgRoles.includes(m.role)) throw problems.forbidden('ამ მოქმედებისთვის საჭიროია სხვა როლი');
      req.org = { id: orgId, role: m.role };
    }
    return true;
  }
}
