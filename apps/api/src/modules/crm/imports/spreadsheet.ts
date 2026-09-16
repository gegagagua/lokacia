import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

/** Parses .xlsx or .csv into a matrix of trimmed strings (first sheet). */
export async function parseSpreadsheet(buf: Buffer, fileName: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  const isCsv = /\.csv$/i.test(fileName) || (!/\.xlsx$/i.test(fileName) && !buf.subarray(0, 2).equals(Buffer.from('PK')));
  let ws: ExcelJS.Worksheet;
  if (isCsv) {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    ws = await wb.csv.read(Readable.from([text]), { parserOptions: { delimiter: detectDelimiter(text) } });
  } else {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    ws = wb.worksheets[0]!;
  }
  if (!ws) return [];
  const rows: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const out: string[] = [];
    for (let c = 1; c <= width; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      let s: string;
      if (v === null || v === undefined) s = '';
      else if (typeof v === 'object' && 'text' in (v as object)) s = String((v as { text: unknown }).text ?? '');
      else if (typeof v === 'object' && 'result' in (v as object)) s = String((v as { result: unknown }).result ?? '');
      else if (v instanceof Date) s = v.toISOString().slice(0, 10);
      else s = String(v);
      out.push(s.trim());
    }
    if (out.some(Boolean)) rows.push(out);
  });
  return rows;
}

function detectDelimiter(text: string) {
  const first = text.split(/\r?\n/)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1]);
  return counts[0]![0];
}

export async function buildWorkbook(sheetName: string, headers: string[], rows: (string | number | null)[][], format: 'xlsx' | 'csv'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'lokacia CRM';
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col) => (col.width = 22));
  if (format === 'csv') return Buffer.concat([Buffer.from('﻿'), Buffer.from(await wb.csv.writeBuffer())]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
