import type { Request } from 'express';
import type { OrgRole, Role } from '@lokacia/contracts';

export type AuthUser = { id: string; role: Role; impersonatorId?: string | null; sessionId?: string };
export type OrgCtx = { id: string; role: OrgRole | 'admin' };

export type AppRequest = Request & { user?: AuthUser; org?: OrgCtx; apiKey?: { id: string; orgId: string | null; scopes: string[] } };
