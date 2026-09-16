import { z } from 'zod';

/** CRM contracts — documents & e-sign (C21), co-brokering (C22). */

export const DOCUMENT_TEMPLATES = ['exclusivity', 'act', 'lease'] as const;
export type DocumentTemplateKey = (typeof DOCUMENT_TEMPLATES)[number] | 'custom';
export const DOCUMENT_TEMPLATE_LABELS_KA: Record<DocumentTemplateKey, string> = {
  exclusivity: 'ექსკლუზიური მომსახურების ხელშეკრულება',
  act: 'ფართის მიღება-გადაცემის აქტი',
  lease: 'იჯარის ხელშეკრულების პროექტი',
  custom: 'სხვა დოკუმენტი',
};
export const SIGN_STATUS_LABELS_KA = { draft: 'მონახაზი', sent: 'ხელმოწერასთვის გაგზავნილი', signed: 'ხელმოწერილი', declined: 'უარყოფილი' } as const;

export const documentCreateSchema = z.object({
  template: z.enum(DOCUMENT_TEMPLATES),
  dealId: z.string().uuid().nullish(),
  contactId: z.string().uuid().nullish(),
  title: z.string().trim().min(2).max(200).nullish(),
  fields: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type DocumentCreate = z.infer<typeof documentCreateSchema>;

export const documentVersionSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  fields: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  text: z.string().max(50_000).optional(),
});

export const documentSendSchema = z.object({
  signerName: z.string().trim().min(2).max(120),
  signerPhone: z.string().trim().max(40).nullish(),
});

export const documentSignSchema = z.object({
  decision: z.enum(['sign', 'decline']),
  name: z.string().trim().min(2).max(120),
});

export type CrmDocument = {
  id: string;
  rootId: string;
  parentId: string | null;
  template: DocumentTemplateKey;
  title: string;
  version: number;
  versionsCount: number;
  dealId: string | null;
  dealTitle: string | null;
  contactId: string | null;
  contactName: string | null;
  signStatus: 'draft' | 'sent' | 'signed' | 'declined';
  signRef: string | null;
  signUrl: string | null;
  signedAt: string | null;
  fields: Record<string, string | number>;
  text: string;
  createdAt: string;
};

export const cobrokerShareSchema = z.object({
  listingId: z.string().uuid(),
  toOrgId: z.string().uuid(),
  splitPct: z.number().min(1).max(99),
  note: z.string().max(500).nullish(),
});
export type CobrokerShareInput = z.infer<typeof cobrokerShareSchema>;
export const COBROKER_STATUS_LABELS_KA = { proposed: 'შეთავაზებული', accepted: 'მიღებული', declined: 'უარყოფილი', revoked: 'გაუქმებული' } as const;
