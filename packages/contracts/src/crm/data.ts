import { z } from 'zod';

/** CRM contracts — import / export / audit (C24). */

export const IMPORT_FIELDS = ['name', 'phone', 'email', 'company', 'type', 'tags', 'source', 'notes'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const IMPORT_FIELD_LABELS_KA: Record<ImportField, string> = {
  name: 'სახელი',
  phone: 'ტელეფონი',
  email: 'ელ-ფოსტა',
  company: 'კომპანია',
  type: 'ტიპი',
  tags: 'თეგები',
  source: 'წყარო',
  notes: 'შენიშვნა',
};

/** Column header → field heuristics (Georgian / English / Russian). */
export function suggestImportField(header: string): ImportField | null {
  const h = header.trim().toLowerCase();
  const rules: [ImportField, RegExp][] = [
    ['phone', /(ტელ|phone|mobile|tel|телефон|ნომერ)/],
    ['email', /(mail|ფოსტ|почта)/],
    ['company', /(კომპან|company|firm|организ|შპს)/],
    ['type', /(ტიპ|type|тип)/],
    ['tags', /(თეგ|tag|тег)/],
    ['source', /(წყარ|source|источник|channel)/],
    ['notes', /(შენიშ|note|comment|კომენტ|примеч)/],
    ['name', /(სახელ|name|client|კლიენტ|имя|фио|კონტაქტ)/],
  ];
  return rules.find(([, re]) => re.test(h))?.[0] ?? null;
}

export const importCommitSchema = z.object({
  fileToken: z.string().min(10).max(200),
  mapping: z.record(z.string(), z.enum(IMPORT_FIELDS)),
  dryRun: z.boolean().default(false),
});
export type ImportCommit = z.infer<typeof importCommitSchema>;

export const sheetsImportSchema = z.object({ url: z.string().url().max(500) });

export type ImportPreview = { fileToken: string; fileName: string; headers: string[]; rows: string[][]; rowsTotal: number; suggested: Record<string, ImportField> };
export type ImportResult = { id: string | null; rowsTotal: number; rowsImported: number; errors: { row: number; message: string }[]; status: 'done' | 'failed'; dryRun: boolean };

export const EXPORT_ENTITIES = ['contacts', 'deals', 'tasks'] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export const crmAuditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorId: z.string().uuid().optional(),
  entity: z.string().max(60).optional(),
  action: z.string().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type CrmAuditRow = { id: string; actorId: string | null; actorName: string | null; action: string; entity: string; entityId: string | null; diff: unknown; ip: string | null; createdAt: string };
