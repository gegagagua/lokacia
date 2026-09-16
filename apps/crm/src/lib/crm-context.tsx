'use client';
import * as React from 'react';
import useSWR from 'swr';
import { crmCan, type CrmMember, type CrmPermission, type OrgRole, type SessionUser } from '@lokacia/contracts';
import type { PipelineStage } from './types';
import { apiFetch } from './api-client';
import { writeOrgCookie } from './org';

export type CrmWorkspace = {
  org: { id: string; name: string; slug: string; type: 'agency' | 'developer'; logoUrl: string | null; brandColor: string | null; leadDistribution: 'round_robin' | 'district' | 'manual'; plan: string };
  role: OrgRole | 'admin';
  userId: string;
  permissions: CrmPermission[];
  pipeline: { id: string; name: string; stages: PipelineStage[] } | null;
};

type Ctx = {
  user: SessionUser;
  org: SessionUser['orgs'][number];
  role: OrgRole | 'admin';
  workspace: CrmWorkspace | undefined;
  can: (p: CrmPermission) => boolean;
  switchOrg: (id: string) => void;
  members: CrmMember[];
  memberName: (userId: string | null | undefined) => string;
  refreshWorkspace: () => Promise<unknown>;
};

const CrmCtx = React.createContext<Ctx | null>(null);

export function CrmProvider({ user, orgId, children }: { user: SessionUser; orgId: string; children: React.ReactNode }) {
  const org = user.orgs.find((o) => o.id === orgId) ?? user.orgs[0]!;
  React.useEffect(() => writeOrgCookie(org.id), [org.id]);
  const { data: workspace, mutate } = useSWR<CrmWorkspace>(['/crm/context', org.id], ([p, id]: [string, string]) => apiFetch<CrmWorkspace>(p, { orgId: id }), { revalidateOnFocus: false });
  const { data: members = [] } = useSWR<CrmMember[]>(['/orgs/current/members', org.id], ([p, id]: [string, string]) => apiFetch<CrmMember[]>(p, { orgId: id }), { revalidateOnFocus: false });
  const role = workspace?.role ?? (user.role === 'admin' ? 'admin' : org.role);
  const value = React.useMemo<Ctx>(
    () => ({
      user,
      org,
      role,
      workspace,
      can: (p) => crmCan(role, p),
      switchOrg: (id) => {
        writeOrgCookie(id);
        window.location.href = '/dashboard';
      },
      members,
      memberName: (id) => (id ? (members.find((m) => m.userId === id)?.name ?? '—') : '—'),
      refreshWorkspace: () => mutate(),
    }),
    [user, org, role, workspace, members, mutate],
  );
  return <CrmCtx.Provider value={value}>{children}</CrmCtx.Provider>;
}

export function useCrm() {
  const c = React.useContext(CrmCtx);
  if (!c) throw new Error('useCrm must be used inside <CrmProvider>');
  return c;
}

/** Renders children only when the current role has the permission (UI mirror of the API guard). */
export function Can({ perm, children, fallback = null }: { perm: CrmPermission; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = useCrm();
  return <>{can(perm) ? children : fallback}</>;
}
