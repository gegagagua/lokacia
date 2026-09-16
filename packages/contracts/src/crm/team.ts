import { z } from 'zod';
import { ORG_ROLES } from '../common';

/** CRM contracts — team, lead distribution (C17). */

export const LEAD_DISTRIBUTION_MODES = ['round_robin', 'district', 'manual'] as const;
export type LeadDistributionMode = (typeof LEAD_DISTRIBUTION_MODES)[number];
export const LEAD_DISTRIBUTION_LABELS_KA: Record<LeadDistributionMode, string> = {
  round_robin: 'რიგრიგობით (round robin)',
  district: 'უბნების მიხედვით',
  manual: 'ხელით',
};

export const teamMemberUpdateSchema = z.object({
  role: z.enum(ORG_ROLES).optional(),
  districtIds: z.array(z.string().uuid()).max(50).optional(),
  active: z.boolean().optional(),
});

export type TeamMemberStats = {
  id: string;
  userId: string | null;
  name: string | null;
  phone: string | null;
  invitedPhone: string | null;
  avatarUrl: string | null;
  role: (typeof ORG_ROLES)[number];
  active: boolean;
  acceptedAt: string | null;
  districtIds: string[];
  stats: { contacts: number; openDeals: number; wonThisMonth: number; overdueTasks: number };
};
