import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { formatDateKa } from '@lokacia/contracts';
import { repoRoot } from '../../../config/env';

export function crmFontPath(file: 'NotoSansGeorgian-Regular.ttf' | 'NotoSansGeorgian-Bold.ttf') {
  const candidates = [path.join(repoRoot(), 'apps/api/assets/fonts', file), path.join(process.cwd(), 'assets/fonts', file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`font ${file} not found`);
  return found;
}

/** Renders a CRM document (C21) as an A4 PDF with Noto Sans Georgian. */
export function renderDocumentPdf(d: { title: string; text: string; org: string; version: number; brandColor?: string | null; signStatus: string; signedAt?: Date | null; signerName?: string | null }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: d.title, Author: d.org } });
    const chunks: Buffer[] = [];
    doc.on('data', (b: Buffer) => chunks.push(b));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('ka', crmFontPath('NotoSansGeorgian-Regular.ttf'));
    doc.registerFont('ka-bold', crmFontPath('NotoSansGeorgian-Bold.ttf'));
    const W = doc.page.width - 112;
    const accent = d.brandColor && /^#[0-9a-f]{6}$/i.test(d.brandColor) ? d.brandColor : '#1E4A42';
    doc.font('ka-bold').fontSize(10).fillColor(accent).text(d.org, 56, 40, { width: W / 2 });
    doc.font('ka').fontSize(9).fillColor('#5C6A63').text(`ვერსია ${d.version} · ${formatDateKa(new Date())}`, 56, 40, { width: W, align: 'right' });
    doc.moveTo(56, 58).lineTo(56 + W, 58).lineWidth(0.8).strokeColor(accent).stroke();
    doc.y = 76;
    doc.font('ka-bold').fontSize(17).fillColor('#17201D').text(d.title, 56, doc.y, { width: W });
    doc.moveDown(0.8);
    doc.font('ka').fontSize(10.5).fillColor('#17201D').text(d.text.replace(/ მ²/g, ' კვ.მ').replace(/²/g, '2'), { width: W, lineGap: 3 });
    doc.moveDown(2);
    const y = doc.y;
    doc.moveTo(56, y).lineTo(56 + 200, y).lineWidth(0.5).strokeColor('#8A968F').stroke();
    doc.moveTo(56 + W - 200, y).lineTo(56 + W, y).stroke();
    doc.font('ka').fontSize(9).fillColor('#5C6A63').text('აგენტურა', 56, y + 4, { width: 200 });
    doc.text(d.signStatus === 'signed' ? `ხელმოწერილია ელექტრონულად${d.signerName ? `: ${d.signerName}` : ''}${d.signedAt ? `, ${formatDateKa(d.signedAt)}` : ''}` : 'დამკვეთი', 56 + W - 200, y + 4, { width: 200 });
    doc.end();
  });
}
