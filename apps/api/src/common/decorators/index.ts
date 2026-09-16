import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { OrgRole, Role } from '@lokacia/contracts';
import type { AppRequest } from '../request';

export const IS_PUBLIC = 'isPublic';
/** Route works without login; `@CurrentUser()` may still be present. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
/** Platform roles allowed (admin always allowed). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ORG_ROLES_KEY = 'orgRoles';
export const ORG_SCOPED = 'orgScoped';
/** Requires `x-org-id` header of an org where the user is an active member. Optionally restricts org roles. */
export const OrgScoped = (...roles: OrgRole[]) => (target: object, key?: string | symbol, desc?: PropertyDescriptor) => {
  SetMetadata(ORG_SCOPED, true)(target, key as string, desc as PropertyDescriptor);
  if (roles.length) SetMetadata(ORG_ROLES_KEY, roles)(target, key as string, desc as PropertyDescriptor);
};

export const NO_IMPERSONATION = 'noImpersonation';
/** Refused while an admin is impersonating the user (money movement, API keys, account deletion, data export). */
export const NoImpersonation = () => SetMetadata(NO_IMPERSONATION, true);

export const SKIP_AUDIT = 'skipAudit';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().user);
export const OrgId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().org?.id);
export const Org = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().org);
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  return (req.headers['cf-connecting-ip'] as string) ?? req.ip ?? '0.0.0.0';
});
