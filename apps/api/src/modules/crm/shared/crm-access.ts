import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, crmContacts, crmDeals, eq, isNull, listings, type Tx } from '@lokacia/db';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Visible contact inside an org transaction (mirrors ContactsService.scope): not deleted/merged, agents only their own.
 * Throws 404 (never 403) so linking someone else's record cannot be used to probe or read it.
 */
export async function visibleContact(tx: Tx, ctx: CrmCtx, id: string) {
  if (!UUID_RE.test(id)) throw problems.notFound('კონტაქტი');
  const c = await tx.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, id), isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId), ctx.ownContactsOnly ? eq(crmContacts.ownerAgentId, ctx.userId) : undefined) });
  if (!c) throw problems.notFound('კონტაქტი');
  return c;
}

/** Visible deal inside an org transaction (mirrors DealsService.findVisible): agents only deals assigned to them. */
export async function visibleDeal(tx: Tx, ctx: CrmCtx, id: string) {
  if (!UUID_RE.test(id)) throw problems.notFound('გარიგება');
  const d = await tx.query.crmDeals.findFirst({ where: and(eq(crmDeals.id, id), isNull(crmDeals.deletedAt), ctx.ownDealsOnly ? eq(crmDeals.agentId, ctx.userId) : undefined) });
  if (!d) throw problems.notFound('გარიგება');
  return d;
}

/** A listing an org may reference (deals, presentations): its own listings in any status, other orgs' only while publicly active. */
export async function usableListing(tx: Tx, ctx: Pick<CrmCtx, 'orgId'>, id: string) {
  if (!UUID_RE.test(id)) throw problems.notFound('ფართი');
  const l = await tx.query.listings.findFirst({ where: and(eq(listings.id, id), isNull(listings.deletedAt)) });
  if (!l || (l.orgId !== ctx.orgId && l.status !== 'active')) throw problems.notFound('ფართი');
  return l;
}
