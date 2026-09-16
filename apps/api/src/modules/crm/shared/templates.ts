import { registerTemplates } from '../../notifications/templates';

/** CRM notification templates (Georgian). Submodules may register more in their own files. */
registerTemplates({
  crm_lead_assigned: { title: () => 'CRM: ახალი ლიდი თქვენზე', body: (v) => `${v.contact}${v.source ? ` — წყარო: ${v.source}` : ''}` },
  crm_task_reminder: { title: () => 'CRM: შეხსენება', body: (v) => `${v.title} — ${v.when}` },
  crm_presentation_opened: { title: () => 'CRM: კლიენტმა გახსნა პრეზენტაცია', body: (v) => `„${v.title}“${v.contact ? ` — ${v.contact}` : ''}` },
  crm_portal_feedback: { title: () => 'CRM: კლიენტის გამოხმაურება', body: (v) => `${v.contact}: ${v.reaction} — ${v.title}` },
  crm_inbox_message: { title: (v) => `CRM: ახალი შეტყობინება (${v.channel})`, body: (v) => `${v.from}: ${v.body}` },
  crm_cobroker_share: { title: () => 'CRM: ფართის გაზიარების შეთავაზება', body: (v) => `${v.org} — „${v.title}“, კომისიის გაყოფა ${v.split}%` },
  crm_document_signed: { title: () => 'CRM: დოკუმენტი ხელმოწერილია', body: (v) => `„${v.title}“` },
  crm_sequence_message: { title: (v) => String(v.title ?? 'lokacia.ge'), body: (v) => String(v.body ?? '') },
  crm_owner_report: { title: () => 'კვირის რეპორტი თქვენ ფართისთვის', body: (v) => `„${v.title}“: ${v.views} ნახვა, ${v.reveals} ზარი, ${v.viewings} ჩვენება` },
  crm_competitor_price: { title: () => 'CRM: კონკურენტის ფასი შეიცვალა', body: (v) => `${v.portal}: ${v.old} → ${v.new}` },
});

export const CRM_TEMPLATES_LOADED = true;
