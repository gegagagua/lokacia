import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { crmCan, type CrmPermission, type OrgRole } from '@lokacia/contracts';
import { OrgScoped } from '../../../common/decorators';
import { problems } from '../../../common/problem';
import type { AppRequest } from '../../../common/request';

export const CRM_PERMS_KEY = 'crmPerms';

/** Checks CRM permissions (C17) after the global AuthGuard resolved `req.org` from `x-org-id`. */
@Injectable()
export class CrmPermGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const perms = this.reflector.getAllAndMerge<CrmPermission[]>(CRM_PERMS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (!perms.length) return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const role = req.org?.role;
    const missing = perms.find((p) => !crmCan(role, p));
    if (missing) throw problems.forbidden(`ამ მოქმედებისთვის საჭიროია უფლება: ${missing}`);
    return true;
  }
}

/**
 * Marks a controller/route as CRM: requires login + `x-org-id` membership (RLS org context) and optional permissions.
 * Usage: `@Crm()` on the controller, `@Crm('finance.view')` on a route.
 */
export const Crm = (...perms: CrmPermission[]) => applyDecorators(OrgScoped(), SetMetadata(CRM_PERMS_KEY, perms), UseGuards(CrmPermGuard));

export type CrmCtx = {
  orgId: string;
  userId: string;
  role: OrgRole | 'admin';
  can: (p: CrmPermission) => boolean;
  /** Agents only see contacts assigned to them (owner_agent_id). */
  ownContactsOnly: boolean;
  /** Agents only see deals assigned to them (agent_id). */
  ownDealsOnly: boolean;
};

export function crmCtxFromRequest(req: AppRequest): CrmCtx {
  if (!req.org || !req.user) throw problems.badRequest('x-org-id header is required');
  const role = req.org.role;
  return {
    orgId: req.org.id,
    userId: req.user.id,
    role,
    can: (p) => crmCan(role, p),
    ownContactsOnly: !crmCan(role, 'contacts.viewAll'),
    ownDealsOnly: !crmCan(role, 'deals.viewAll'),
  };
}

/** Param decorator: `@Ctx() ctx: CrmCtx`. */
export const Ctx = createParamDecorator((_: unknown, ctx: ExecutionContext) => crmCtxFromRequest(ctx.switchToHttp().getRequest<AppRequest>()));

export function assertCan(ctx: CrmCtx, perm: CrmPermission) {
  if (!ctx.can(perm)) throw problems.forbidden(`ამ მოქმედებისთვის საჭიროია უფლება: ${perm}`);
}
