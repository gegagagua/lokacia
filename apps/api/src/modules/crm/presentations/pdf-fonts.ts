import { existsSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { repoRoot } from '../../../config/env';

/** Brand colors for CRM PDFs (BRAND.md). */
export const CRM_PDF_COLORS = { basalt: '#17201D', green: '#1E4A42', sulfur: '#D8A31A', stone: '#8A968F', plaster: '#EDF0EB', brick: '#B4492F', blue: '#2F5FB8' };

/** Absolute path of a font in apps/api/assets/fonts (works from src/ and dist/). */
export function crmFontPath(file: 'NotoSansGeorgian-Regular.ttf' | 'NotoSansGeorgian-Bold.ttf') {
  const candidates = [path.join(repoRoot(), 'apps/api/assets/fonts', file), path.join(__dirname, '../../../../assets/fonts', file), path.join(process.cwd(), 'assets/fonts', file)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`font ${file} not found`);
  return found;
}

export const CRM_FONTS = {
  regular: () => crmFontPath('NotoSansGeorgian-Regular.ttf'),
  bold: () => crmFontPath('NotoSansGeorgian-Bold.ttf'),
};

/** New A4 pdfkit document with Georgian fonts registered as `ka` and `ka-bold`. */
export function createCrmPdf(info: { title: string; author?: string }) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: info.title, Author: info.author ?? 'lokacia.ge' } });
  doc.registerFont('ka', CRM_FONTS.regular());
  doc.registerFont('ka-bold', CRM_FONTS.bold());
  doc.font('ka');
  return doc;
}

/** Collects a pdfkit document into a Buffer. Call after all drawing; this ends the document. */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
