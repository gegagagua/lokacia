import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DEAL_TYPE_LABELS_KA, FITOUT_PAID_BY_LABELS_KA, formatDateKa, formatMoney, formatNumber, type DealType } from '@lokacia/contracts';
import { repoRoot } from '../../config/env';

export type ContractInput = {
  number: string;
  date: Date;
  owner: { name: string; phone: string | null; email: string | null };
  tenant: { name: string; phone: string | null; email: string | null; company: string | null; activity: string | null };
  listing: { title: string; address: string; areaM2: number; floor: number | null; dealType: DealType; url: string };
  offer: { priceMinor: number; currency: string; termMonths: number; freeMonths: number; indexationPct: number; fitoutPaidBy: 'tenant' | 'owner' | 'shared'; equipmentIncluded: boolean; message: string | null };
  equipment: { name: string; qty: number; priceMinor: number }[];
  depositMonths: number;
  serviceFeeMinor: number;
  consultationUrl: string;
};

function fontPath(file: string) {
  const candidates = [path.join(repoRoot(), 'apps/api/assets/fonts', file), path.join(__dirname, '../../../assets/fonts', file), path.join(process.cwd(), 'assets/fonts', file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`font ${file} not found`);
  return found;
}

const INK = '#17201D';
const MUTED = '#5C6A63';
const GREEN = '#1E4A42';
const BRICK = '#B4492F';

/** P17: contract draft PDF from an accepted offer (Noto Sans Georgian via pdfkit). Legal text is a flagged placeholder (HUMAN_TODO #7). */
@Injectable()
export class ContractPdfService {
  render(input: ContractInput): Promise<Buffer> {
    // Noto Sans Georgian has no superscript two: m² → კვ.მ
    const fix = (v: string) => v.replace(/მ²|m²/g, 'კვ.მ').replace(/²/g, '2');
    const c: ContractInput = { ...input, listing: { ...input.listing, title: fix(input.listing.title), address: fix(input.listing.address) }, offer: { ...input.offer, message: input.offer.message ? fix(input.offer.message) : null }, equipment: input.equipment.map((e) => ({ ...e, name: fix(e.name) })) };
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: `ხელშეკრულების პროექტი ${c.number}`, Author: 'lokacia.ge', Subject: c.listing.title } });
      const chunks: Buffer[] = [];
      doc.on('data', (b: Buffer) => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.registerFont('ka', fontPath('NotoSansGeorgian-Regular.ttf'));
      doc.registerFont('ka-bold', fontPath('NotoSansGeorgian-Bold.ttf'));
      const W = doc.page.width - 112;
      const isSale = c.listing.dealType === 'sale';
      const isTransfer = c.listing.dealType === 'transfer';
      const kindTitle = isSale ? 'ნასყიდობის' : isTransfer ? 'ბიზნესის გადაცემის' : 'იჯარის';

      // header
      doc.font('ka-bold').fontSize(10).fillColor(GREEN).text('lokacia.ge', 56, 40);
      doc.font('ka').fontSize(9).fillColor(MUTED).text(`№ ${c.number} · ${formatDateKa(c.date)}`, 56, 40, { width: W, align: 'right' });
      doc.moveTo(56, 58).lineTo(56 + W, 58).lineWidth(0.6).strokeColor(GREEN).stroke();

      doc.moveDown(2);
      doc.font('ka-bold').fontSize(18).fillColor(INK).text(`${kindTitle} ხელშეკრულების პროექტი`, { width: W });
      doc.moveDown(0.3);
      doc.font('ka').fontSize(10).fillColor(MUTED).text('შედგენილია lokacia.ge-ზე მიღებული შეთავაზების საფუძველზე.', { width: W });

      // placeholder banner
      doc.moveDown(0.8);
      const bannerY = doc.y;
      const bannerBody = 'ხელშეკრულების სამართლებრივი ტექსტი იურისტის მიერ გადამოწმებას საჭიროებს. ხელმოწერამდე მიიღეთ იურისტის კონსულტაცია.';
      doc.font('ka').fontSize(9);
      const bannerH = 30 + doc.heightOfString(bannerBody, { width: W - 24 });
      doc.rect(56, bannerY, W, bannerH).lineWidth(1).strokeColor(BRICK).stroke();
      doc.font('ka-bold').fontSize(10).fillColor(BRICK).text('დემო-ტექსტი — არ არის იურიდიული დოკუმენტი', 68, bannerY + 8, { width: W - 24 });
      doc.font('ka').fontSize(9).fillColor(BRICK).text(bannerBody, 68, bannerY + 22, { width: W - 24 });
      doc.y = bannerY + bannerH + 14;

      const section = (title: string) => {
        doc.moveDown(0.6);
        doc.font('ka-bold').fontSize(12).fillColor(GREEN).text(title, 56, doc.y, { width: W });
        doc.moveTo(56, doc.y + 2).lineTo(56 + W, doc.y + 2).lineWidth(0.4).strokeColor('#8A968F').stroke();
        doc.moveDown(0.5);
      };
      const row = (label: string, value: string) => {
        const y = doc.y;
        doc.font('ka').fontSize(10).fillColor(MUTED).text(label, 56, y, { width: 190 });
        const h1 = doc.y - y;
        doc.font('ka').fontSize(10).fillColor(INK).text(value, 256, y, { width: W - 200 });
        doc.y = Math.max(y + h1, doc.y) + 3;
      };
      const para = (n: string, text: string) => {
        doc.font('ka').fontSize(10).fillColor(INK).text(`${n} ${text}`, 56, doc.y, { width: W, align: 'justify', lineGap: 2 });
        doc.moveDown(0.4);
      };

      section('1. მხარეები');
      row(isSale ? 'გამყიდველი' : 'მეიჯარე (მესაკუთრე)', [c.owner.name, c.owner.phone, c.owner.email].filter(Boolean).join(', '));
      row(isSale ? 'მყიდველი' : 'მოიჯარე', [c.tenant.company ? `${c.tenant.company} (${c.tenant.name})` : c.tenant.name, c.tenant.phone, c.tenant.email].filter(Boolean).join(', '));
      if (c.tenant.activity) row('საქმიანობა', c.tenant.activity);

      section('2. ფართი');
      row('დასახელება', c.listing.title);
      row('მისამართი', c.listing.address);
      row('ფართობი', `${formatNumber(c.listing.areaM2, Number.isInteger(c.listing.areaM2) ? 0 : 1)} კვ.მ`);
      if (c.listing.floor != null) row('ქანობი', String(c.listing.floor));
      row('გარიგების ტიპი', DEAL_TYPE_LABELS_KA[c.listing.dealType]);
      row('განცხადება', c.listing.url);

      section('3. ფასი და ვადა');
      row(isSale || isTransfer ? 'ფასი' : 'ყოველთვიური იჯარა', formatMoney(c.offer.priceMinor, c.offer.currency));
      if (!isSale) {
        row('ვადა', `${c.offer.termMonths} თვე`);
        row('უფასო თვეები (მოწყობისთვის)', c.offer.freeMonths ? `${c.offer.freeMonths} თვე` : 'არ არის');
        row('ყოველწლიური ინდექსაცია', c.offer.indexationPct ? `${c.offer.indexationPct}%` : 'არ არის');
        row('დეპოზიტი', `${formatNumber(c.depositMonths, 1)} თვის იჯარა (${formatMoney(Math.round(c.offer.priceMinor * c.depositMonths), c.offer.currency)})`);
        if (c.serviceFeeMinor) row('მომსახურების საფასური', `${formatMoney(c.serviceFeeMinor)} / თვე`);
      }
      row('მოწყობის ხარჯი', FITOUT_PAID_BY_LABELS_KA[c.offer.fitoutPaidBy]);
      if (c.offer.message) row('დამატებითი პირობები', c.offer.message);

      if (isTransfer || c.equipment.length) {
        section('4. გადასცემი აღჭურვილობა');
        if (!c.offer.equipmentIncluded) doc.font('ka').fontSize(10).fillColor(INK).text('აღჭურვილობა შეთავაზებაში არ შედის.', 56, doc.y, { width: W });
        else {
          for (const e of c.equipment) row(`${e.name}${e.qty > 1 ? ` × ${e.qty}` : ''}`, formatMoney(e.priceMinor * e.qty));
          row('ჯამი', formatMoney(c.equipment.reduce((a, e) => a + e.priceMinor * e.qty, 0)));
        }
      }

      const tn = isTransfer || c.equipment.length ? 5 : 4;
      section(`${tn}. ძირითადი პირობები (დემო-ტექსტი)`);
      const term = isSale ? '' : `${c.offer.termMonths} თვის`;
      para(`${tn}.1.`, isSale ? 'გამყიდველი გადასცემს, მყიდველი იღებს ფართს საკუთრებაში ზემოთ მითითებული ფასის სრული გადახდის შემდეგ.' : `მეიჯარე გადასცემს, მოიჯარე იღებს ფართს ${term} ვადით, ხელშეკრულების ხელმოწერის დღიდან.`);
      if (!isSale) {
        para(`${tn}.2.`, c.offer.freeMonths ? `პირველი ${c.offer.freeMonths} თვე იჯარა არ გადახდება — ეს პერიოდი განკუთვნილია ფართის მოწყობისთვის.` : 'იჯარა გადახდება ყოველთვიურად, ყოველი თვის 5 რიცხვამდე.');
        para(`${tn}.3.`, c.offer.indexationPct ? `იჯარის ფასი ყოველწლიურად ინდექსირდება ${c.offer.indexationPct}%-ით.` : 'იჯარის ფასი ხელშეკრულების ვადაში არ ინდექსირდება.');
        para(`${tn}.4.`, 'ხელშეკრულების ვადამდე მოშლის შემთხვევაში მხარე წინასწარ, არანაკლებ 3 თვით ადრე, წერილობით აცნობებს მეორე მხარეს. ვადამდე მოშლის სრული პირობები და ჯარიმები განისაზღვრება იურისტის მიერ.');
      }
      para(isSale ? `${tn}.2.` : `${tn}.5.`, `ფართის მოწყობის ხარჯებს ფარავს: ${FITOUT_PAID_BY_LABELS_KA[c.offer.fitoutPaidBy].toLowerCase()}.`);
      para(isSale ? `${tn}.3.` : `${tn}.6.`, 'დავა მხარეების შორის განიხილება მოლაპარაკების გზით, შეთანხმების მიუღწევლობის შემთხვევაში — საქართველოს კანონმდებლობის შესაბამისად.');

      // signatures
      doc.moveDown(1.2);
      const sy = doc.y;
      doc.font('ka').fontSize(10).fillColor(MUTED).text(isSale ? 'გამყიდველი' : 'მეიჯარე', 56, sy);
      doc.text(isSale ? 'მყიდველი' : 'მოიჯარე', 56 + W / 2 + 10, sy);
      doc.moveTo(56, sy + 40).lineTo(56 + W / 2 - 20, sy + 40).lineWidth(0.6).strokeColor(INK).stroke();
      doc.moveTo(56 + W / 2 + 10, sy + 40).lineTo(56 + W, sy + 40).stroke();
      doc.fillColor(INK).text(c.owner.name, 56, sy + 46, { width: W / 2 - 20 });
      doc.text(c.tenant.name, 56 + W / 2 + 10, sy + 46, { width: W / 2 - 10 });

      // upsell
      doc.moveDown(2);
      doc.font('ka-bold').fontSize(10).fillColor(GREEN).text('იურისტის ფასიანი კონსულტაცია', 56, doc.y, { width: W });
      doc.font('ka').fontSize(9).fillColor(INK).text(`ხელშეკრულების გადამოწმება და ადაპტაცია თქვენ პირობებზე: ${c.consultationUrl}`, 56, doc.y, { width: W, link: c.consultationUrl, underline: false });
      doc.end();
    });
  }
}
