import { Injectable } from '@nestjs/common';
import { eq, invoices, organizations, payments, users } from '@lokacia/db';
import { INVOICE_PURPOSE_LABELS_KA, INVOICE_STATUS_LABELS_KA, formatDateKa, formatMoney } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { SettingsService } from '../../common/settings.service';
import { createPdf, footer, heading, keyValues, paragraph, PDF_COLORS, table, toBuffer } from './pdf';

type InvoiceRow = typeof invoices.$inferSelect;

/** Invoice (open) / receipt (paid) PDFs. */
@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly dbs: DbService,
    private readonly settings: SettingsService,
  ) {}

  async invoicePdf(inv: InvoiceRow) {
    const paid = inv.status === 'paid';
    const payer = inv.orgId
      ? (await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, inv.orgId) }))?.name
      : inv.userId
        ? (await this.dbs.db.query.users.findFirst({ where: eq(users.id, inv.userId) }))?.name
        : null;
    const payment = await this.dbs.db.query.payments.findFirst({ where: eq(payments.invoiceId, inv.id), orderBy: (p, { desc }) => desc(p.createdAt) });
    const vatPct = Number(await this.settings.get('vat_pct')) || 18;
    const vat = Math.round(inv.amountMinor - inv.amountMinor / (1 + vatPct / 100));
    const doc = createPdf(paid ? `ქვითარი № ${inv.number}` : `ინვოისი № ${inv.number}`, `${INVOICE_PURPOSE_LABELS_KA[inv.purpose]} · ${INVOICE_STATUS_LABELS_KA[inv.status]}`);
    keyValues(doc, [
      ['გამყიდველი', 'lokacia.ge (დემო-რეკვიზიტები)'],
      ['მყიდველი', payer ?? '—'],
      ['შექმნის თარიღი', formatDateKa(inv.createdAt)],
      [paid ? 'გადახდის თარიღი' : 'გადახდის ვადა', paid && inv.paidAt ? formatDateKa(inv.paidAt) : inv.dueAt ? formatDateKa(inv.dueAt) : '—'],
      ['გადახდის მეთოდი', payment ? (payment.provider === 'promo' ? 'პრომო-პერიოდი' : payment.provider.toUpperCase()) : '—'],
    ]);
    heading(doc, 'პოზიციები');
    table(doc, ['დასახელება', 'რაოდ.', 'თანხა'], inv.lines.map((l) => [l.name, String(l.qty), formatMoney(l.amountMinor * l.qty)]), [340, 50, 109]);
    doc.moveDown(0.5);
    keyValues(doc, [
      ['სულ', formatMoney(inv.amountMinor)],
      [`მათ შორის დღგ ${vatPct}%`, formatMoney(vat)],
    ]);
    if (paid) {
      doc.moveDown(0.5);
      paragraph(doc, 'გადახდა მიღებულია. გმადლობთ!', { color: PDF_COLORS.green });
    }
    footer(doc, 'დემო-დოკუმენტი: საგადასახადო რეკვიზიტები დაემატება ბანკთან ხელშეკრულების შემდეგ.');
    return toBuffer(doc);
  }
}
