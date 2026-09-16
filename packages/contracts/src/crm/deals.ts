import { z } from 'zod';

/** CRM contracts — deals, pipeline, finance, lead sources, KPI (C3, C18, C19, C20). */

export const PIPELINE_STAGE_KINDS = ['open', 'won', 'lost'] as const;
export type PipelineStageKind = (typeof PIPELINE_STAGE_KINDS)[number];

export const pipelineStageSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'გასაღები: ლათინური პატარა ასოები, ციფრები, _ ან -'),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(PIPELINE_STAGE_KINDS),
});
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;

export const pipelineUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    stages: z.array(pipelineStageSchema).min(3).max(20),
    /** When a stage with deals is removed, its deals move to these stages: { removedKey: targetKey }. */
    moveTo: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((v, ctx) => {
    const keys = v.stages.map((s) => s.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'ეტაპების გასაღებები უნდა იყოს უნიკალური' });
    const count = (k: PipelineStageKind) => v.stages.filter((s) => s.kind === k).length;
    if (count('open') < 1) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'საჭიროია მინიმუმ ერთი ღია ეტაპი' });
    if (count('won') !== 1) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'საჭიროია ზუსტად ერთი „მოგებული“ ეტაპი' });
    if (count('lost') !== 1) ctx.addIssue({ code: 'custom', path: ['stages'], message: 'საჭიროია ზუსტად ერთი „წაგებული“ ეტაპი' });
  });
export type PipelineUpdate = z.infer<typeof pipelineUpdateSchema>;

export const dealBoardQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  source: z.string().max(60).optional(),
  contactId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
});

export type DealCard = {
  id: string;
  title: string;
  stage: string;
  position: number;
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
  listingId: string | null;
  listingTitle: string | null;
  listingAddress: string | null;
  agentId: string | null;
  agentName: string | null;
  source: string | null;
  valueMinor: number | null;
  commissionPct: number | null;
  commissionMinor: number | null;
  agentSharePct: number | null;
  lostReason: string | null;
  expectedCloseAt: string | null;
  closedAt: string | null;
  createdAt: string;
  stageChangedAt: string;
  daysInStage: number;
};

export type DealFinanceView = { valueMinor: number; commissionPct: number; agentSharePct: number; commissionMinor: number; agentMinor: number; agencyMinor: number; expectedMinor: number; probabilityPct: number };

/** Stage probability for weighted expected revenue (open stages spread 10%→80% by order; won 100%, lost 0%). */
export function stageProbabilityPct(stages: { key: string; kind: PipelineStageKind }[], stageKey: string): number {
  const st = stages.find((s) => s.key === stageKey);
  if (!st) return 0;
  if (st.kind === 'won') return 100;
  if (st.kind === 'lost') return 0;
  const open = stages.filter((s) => s.kind === 'open');
  const i = open.findIndex((s) => s.key === stageKey);
  if (open.length <= 1) return 50;
  return Math.round(10 + (70 * i) / (open.length - 1));
}

export const leadSourceSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'გასაღები: ლათინური პატარა ასოები, ციფრები, _ ან -'),
  name: z.string().trim().min(1).max(80),
  monthlyCostMinor: z.number().int().min(0).max(1_000_000_000).default(0),
});
export const leadSourceUpdateSchema = leadSourceSchema.partial();

export type SourceRoi = {
  key: string;
  name: string;
  monthlyCostMinor: number | null;
  leads: number;
  deals: number;
  won: number;
  wonCommissionMinor: number | null;
  costMinor: number | null;
  roiPct: number | null;
  costPerLeadMinor: number | null;
  conversionPct: number;
};

export const kpiQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  agentId: z.string().uuid().optional(),
});

export type KpiReport = {
  period: { from: string; to: string };
  byStage: { key: string; name: string; kind: PipelineStageKind; count: number; valueMinor: number | null }[];
  totals: {
    openDeals: number;
    wonCount: number;
    lostCount: number;
    winRatePct: number;
    leadToWonPct: number;
    avgCycleDays: number | null;
    wonValueMinor: number | null;
    wonCommissionMinor: number | null;
    pipelineValueMinor: number | null;
    newContacts: number;
    newDeals: number;
    viewings: number;
    tasksOverdue: number;
  };
  ranking: { agentId: string; name: string | null; wonCount: number; lostCount: number; wonCommissionMinor: number | null; conversionPct: number; openDeals: number }[];
  monthly: { month: string; wonCount: number; wonValueMinor: number | null }[];
  financeHidden: boolean;
  scope: 'org' | 'own';
};
