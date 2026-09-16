/**
 * Zod schemas & types owned by the CRM work stream (C1–C24).
 * Split per area under ./crm/ so parallel work does not collide; this file only re-exports.
 * Base schemas already in domain.ts (contactSchema, dealSchema, dealMoveSchema, taskSchema, dealFinance) are reused.
 */
export * from './crm/access';
export * from './crm/contacts';
export * from './crm/deals';
export * from './crm/schedule';
export * from './crm/inbox';
export * from './crm/marketing';
export * from './crm/team';
export * from './crm/documents';
export * from './crm/data';
