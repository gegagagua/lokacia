import { existsSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { formatDateKa, formatMoney } from '@lokacia/contracts';
import { repoRoot } from '../../config/env';

const BRAND = { basalt: '#17201D', green: '#1E4A42', sulfur: '#D8A31A', stone: '#8A968F', plaster: '#EDF0EB', brick: '#B4492F', blue: '#2F5FB8' };
export const PDF_COLORS = BRAND;

function fontPath(file: string) {
  const candidates = [path.join(repoRoot(), 'apps/api/assets/fonts', file), path.join(__dirname, '../../../assets/fonts', file), path.join(process.cwd(), 'assets/fonts', file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`font ${file} not found`);
  return found;
}

export type Pdf = PDFKit.PDFDocument;

/** Creates an A4 document with the Georgian font registered as `ka` / `ka-bold` and a brand header. */
export function createPdf(title: string, subtitle?: string): Pdf {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Author: 'lokacia.ge' } });
  doc.registerFont('ka', fontPath('NotoSansGeorgian-Regular.ttf'));
  doc.registerFont('ka-bold', fontPath('NotoSansGeorgian-Bold.ttf'));
  // header: plan-corner mark + wordmark
  doc.save();
  doc.lineWidth(2.2).strokeColor(BRAND.green).moveTo(48, 70).lineTo(48, 48).lineTo(70, 48).stroke();
  doc.circle(60, 60, 3).fill(BRAND.sulfur);
  doc.restore();
  doc.font('ka-bold').fontSize(14).fillColor(BRAND.basalt).text('lokacia.ge', 80, 50);
  doc.font('ka').fontSize(9).fillColor(BRAND.stone).text('კომერციული ფართები ბიზნესის თვალით', 80, 68);
  doc.moveTo(48, 92).lineTo(547, 92).lineWidth(0.5).strokeColor(BRAND.stone).stroke();
  doc.font('ka-bold').fontSize(20).fillColor(BRAND.basalt).text(title, 48, 108, { width: 499 });
  if (subtitle) doc.font('ka').fontSize(10).fillColor(BRAND.stone).text(subtitle, { width: 499 });
  doc.moveDown(1);
  doc.fillColor(BRAND.basalt);
  return doc;
}

export function heading(doc: Pdf, text: string) {
  doc.moveDown(0.8);
  doc.font('ka-bold').fontSize(13).fillColor(BRAND.basalt).text(text, 48, undefined, { width: 499 });
  doc.moveDown(0.3);
}

export function paragraph(doc: Pdf, text: string, opts: { color?: string; size?: number } = {}) {
  doc.font('ka').fontSize(opts.size ?? 10).fillColor(opts.color ?? BRAND.basalt).text(text, 48, undefined, { width: 499, lineGap: 2 });
}

/** Two-column key/value rows. */
export function keyValues(doc: Pdf, rows: [string, string][]) {
  for (const [k, v] of rows) {
    const y = doc.y;
    doc.font('ka').fontSize(10).fillColor(BRAND.stone).text(k, 48, y, { width: 220 });
    const h1 = doc.y - y;
    doc.font('ka-bold').fontSize(10).fillColor(BRAND.basalt).text(v, 280, y, { width: 267 });
    doc.y = Math.max(doc.y, y + h1) + 4;
  }
  doc.x = 48;
}

/** Simple table with a header row; last column right-aligned. */
export function table(doc: Pdf, headers: string[], rows: string[][], widths: number[]) {
  const draw = (cells: string[], bold: boolean) => {
    if (doc.y > 760) doc.addPage();
    const y = doc.y;
    let x = 48;
    let maxH = 0;
    cells.forEach((c, i) => {
      doc.font(bold ? 'ka-bold' : 'ka').fontSize(9).fillColor(bold ? BRAND.stone : BRAND.basalt);
      const align = i === cells.length - 1 && cells.length > 1 ? 'right' : 'left';
      doc.text(c, x + 2, y + 4, { width: widths[i]! - 4, align });
      maxH = Math.max(maxH, doc.y - y);
      x += widths[i]!;
    });
    const bottom = y + maxH + 4;
    doc.moveTo(48, bottom).lineTo(48 + widths.reduce((a, b) => a + b, 0), bottom).lineWidth(0.4).strokeColor(BRAND.stone).stroke();
    doc.y = bottom + 2;
  };
  draw(headers, true);
  rows.forEach((r) => draw(r, false));
  doc.x = 48;
}

/** Horizontal bar chart (label, value) — values normalized to max. */
export function bars(doc: Pdf, items: { label: string; value: number; display: string }[], opts: { color?: string } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  for (const it of items) {
    if (doc.y > 770) doc.addPage();
    const y = doc.y;
    doc.font('ka').fontSize(9).fillColor(BRAND.basalt).text(it.label, 48, y + 1, { width: 150, ellipsis: true, lineBreak: false });
    const w = Math.max(1, (it.value / max) * 270);
    doc.rect(205, y + 2, 270, 9).fill(BRAND.plaster);
    doc.rect(205, y + 2, w, 9).fill(opts.color ?? BRAND.green);
    doc.font('ka').fontSize(9).fillColor(BRAND.basalt).text(it.display, 480, y + 1, { width: 67, align: 'right', lineBreak: false });
    doc.y = y + 16;
  }
  doc.x = 48;
}

export function footer(doc: Pdf, note?: string) {
  doc.moveDown(2);
  doc.font('ka').fontSize(8).fillColor(BRAND.stone).text(note ?? `დოკუმენტი შეიქმნა ${formatDateKa(new Date())} · lokacia.ge`, 48, undefined, { width: 499 });
}

export function toBuffer(doc: Pdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export const money = (minor: number) => formatMoney(minor);
