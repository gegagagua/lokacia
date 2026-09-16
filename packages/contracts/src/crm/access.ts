import { z } from 'zod';
import type { OrgRole } from '../common';

/**
 * CRM permission model (C17). Shared by the API guard and the CRM UI (navigation, buttons).
 * - manager: everything
 * - agent: works own contacts/deals (sees only records assigned to them), sees finance of own deals, no team/settings/audit
 * - assistant: sees all org contacts/deals (helps the team) but no finance, no deletes, no settings
 */
export const CRM_PERMISSIONS = [
  'contacts.viewAll',
  'deals.viewAll',
  'records.delete',
  'finance.view',
  'team.manage',
  'settings.manage',
  'pipeline.manage',
  'audit.view',
  'data.import',
  'data.export',
  'sources.manage',
  'sequences.manage',
  'listings.publish',
  'documents.sign',
  'analytics.view',
] as const;
export type CrmPermission = (typeof CRM_PERMISSIONS)[number];

const MANAGER: readonly CrmPermission[] = CRM_PERMISSIONS;
const AGENT: readonly CrmPermission[] = ['records.delete', 'finance.view', 'data.import', 'data.export', 'listings.publish', 'documents.sign', 'analytics.view'];
const ASSISTANT: readonly CrmPermission[] = ['contacts.viewAll', 'deals.viewAll', 'data.import', 'listings.publish'];

export const CRM_ROLE_PERMISSIONS: Record<OrgRole | 'admin', readonly CrmPermission[]> = {
  manager: MANAGER,
  admin: MANAGER,
  agent: AGENT,
  assistant: ASSISTANT,
};

export function crmCan(role: OrgRole | 'admin' | null | undefined, perm: CrmPermission): boolean {
  if (!role) return false;
  return CRM_ROLE_PERMISSIONS[role].includes(perm);
}

export const ORG_ROLE_LABELS_KA: Record<OrgRole, string> = { manager: 'მენეჯერი', agent: 'აგენტი', assistant: 'ასისტენტი' };

/** Generic activity (timeline entry, C1/C7). */
export const ACTIVITY_TYPES = ['note', 'call', 'stage_change', 'email', 'sms', 'viewing', 'merge', 'import', 'message', 'task', 'match', 'document', 'presentation', 'sequence'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activityCreateSchema = z.object({
  entity: z.enum(['contact', 'deal', 'listing']),
  entityId: z.string().uuid(),
  type: z.enum(['note', 'call', 'email', 'sms']),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ActivityCreate = z.infer<typeof activityCreateSchema>;

/** Call log (C7): recorded after a tel: click. */
export const CALL_OUTCOMES = ['answered', 'no_answer', 'busy', 'wrong_number', 'callback'] as const;
export const CALL_OUTCOME_LABELS_KA: Record<(typeof CALL_OUTCOMES)[number], string> = {
  answered: 'შედგა',
  no_answer: 'არ უპასუხა',
  busy: 'დაკავებული',
  wrong_number: 'არასწორი ნომერი',
  callback: 'გადარეკვა',
};
export const callLogSchema = z.object({
  entity: z.enum(['contact', 'deal']).default('contact'),
  entityId: z.string().uuid(),
  phone: z.string().max(40),
  direction: z.enum(['out', 'in']).default('out'),
  outcome: z.enum(CALL_OUTCOMES),
  durationSec: z.number().int().min(0).max(24 * 3600).default(0),
  note: z.string().max(4000).nullish(),
});
export type CallLog = z.infer<typeof callLogSchema>;

export type CrmActivity = {
  id: string;
  entity: 'contact' | 'deal' | 'listing';
  entityId: string;
  type: string;
  payload: Record<string, unknown>;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type CrmSearchResult = {
  contacts: { id: string; name: string; phone: string | null; type: string }[];
  deals: { id: string; title: string; stage: string }[];
  listings: { id: string; title: string; address: string; status: string }[];
};

export type CrmMember = { id: string; userId: string | null; name: string | null; phone: string | null; role: OrgRole; avatarUrl: string | null; active: boolean; districtIds: string[] };
