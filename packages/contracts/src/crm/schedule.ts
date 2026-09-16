import { z } from 'zod';

/** CRM contracts — calendar/viewings (C4), tasks (C5), follow-up sequences (C16). */

const iso = z.string().datetime({ offset: true });

export const crmViewingCreateSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  contactId: z.string().uuid().nullish(),
  dealId: z.string().uuid().nullish(),
  listingId: z.string().uuid().nullish(),
  agentId: z.string().uuid().nullish(),
  startsAt: iso,
  endsAt: iso.nullish(),
  durationMin: z.number().int().min(5).max(24 * 60).default(45),
  address: z.string().max(300).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
});
export type CrmViewingCreate = z.infer<typeof crmViewingCreateSchema>;

export const crmViewingUpdateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  startsAt: iso.optional(),
  endsAt: iso.optional(),
  status: z.enum(['planned', 'done', 'cancelled']).optional(),
  agentId: z.string().uuid().nullish(),
  address: z.string().max(300).nullish(),
});

export const crmViewingsQuerySchema = z.object({
  from: iso.optional(),
  to: iso.optional(),
  agentId: z.string().uuid().optional(),
  status: z.enum(['planned', 'done', 'cancelled']).optional(),
});

export const crmRouteQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentId: z.string().uuid().optional(),
  startLat: z.coerce.number().min(-90).max(90).optional(),
  startLng: z.coerce.number().min(-180).max(180).optional(),
});

export const crmRouteApplySchema = z.object({
  order: z.array(z.string().uuid()).min(1).max(100),
  shiftTimes: z.boolean().default(false),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),
});

export type CrmViewing = {
  id: string;
  title: string;
  address: string | null;
  startsAt: string;
  endsAt: string;
  status: 'planned' | 'done' | 'cancelled';
  routeOrder: number | null;
  googleEventId: string | null;
  lat: number | null;
  lng: number | null;
  agentId: string | null;
  agentName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dealId: string | null;
  dealTitle: string | null;
  listingId: string | null;
  listingTitle: string | null;
};

export type CrmRouteStop = CrmViewing & { order: number; legKm: number; suggestedStart: string };
export type CrmRoute = { date: string; start: { lat: number; lng: number }; stops: CrmRouteStop[]; totalKm: number; originalKm: number; unlocated: CrmViewing[] };

/* ---------------- tasks ---------------- */

export const crmTasksQuerySchema = z.object({
  scope: z.enum(['mine', 'all']).default('mine'),
  view: z.enum(['today', 'overdue', 'upcoming', 'done', 'open']).default('open'),
  dealId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
});

export const crmTaskSnoozeSchema = z.object({
  minutes: z.number().int().min(1).max(60 * 24 * 60).optional(),
  until: iso.optional(),
});

export type CrmTask = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: 'low' | 'normal' | 'high';
  doneAt: string | null;
  remindedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  contactId: string | null;
  contactName: string | null;
  createdAt: string;
};

export type CrmTaskCounts = { today: number; overdue: number; upcoming: number; done: number };

/* ---------------- sequences ---------------- */

export const SEQUENCE_CHANNELS = ['sms', 'email', 'telegram'] as const;
export const SEQUENCE_TRIGGERS = ['after_viewing', 'new_lead', 'manual'] as const;
export const SEQUENCE_TRIGGER_LABELS_KA: Record<(typeof SEQUENCE_TRIGGERS)[number], string> = {
  after_viewing: 'ჩვენების შემდეგ',
  new_lead: 'ახალი ლიდი',
  manual: 'ხელით ჩართვა',
};

export const sequenceStepSchema = z.object({
  delayDays: z.number().int().min(0).max(365),
  channel: z.enum(SEQUENCE_CHANNELS),
  template: z.string().trim().min(1).max(1000),
});

export const sequenceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  trigger: z.enum(SEQUENCE_TRIGGERS).default('manual'),
  steps: z.array(sequenceStepSchema).min(1).max(20),
  active: z.boolean().default(true),
});
export type SequenceInput = z.infer<typeof sequenceSchema>;

export const sequenceEnrollSchema = z.object({ contactId: z.string().uuid(), dealId: z.string().uuid().nullish() });

/** Renders `{name}`, `{agent}`, `{org}` placeholders. Unknown placeholders stay as is. */
export function renderSequenceTemplate(template: string, vars: Record<string, string | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] != null ? String(vars[k]) : m));
}

export type CrmSequence = SequenceInput & { id: string; createdAt: string; running: number; done: number; stopped: number };
export type CrmSequenceRun = {
  id: string;
  sequenceId: string;
  sequenceName: string;
  contactId: string;
  contactName: string | null;
  dealId: string | null;
  step: number;
  stepsTotal: number;
  nextAt: string | null;
  lastRunAt: string | null;
  status: 'running' | 'done' | 'stopped';
  createdAt: string;
};
