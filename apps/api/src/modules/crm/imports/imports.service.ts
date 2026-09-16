import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { and, crmContacts, crmDeals, crmImports, crmTasks, desc, eq, isNull, users, inArray } from '@lokacia/db';
import { crmCan, IMPORT_FIELDS, normalizePhone, suggestImportField, type ExportEntity, type ImportField, type ImportPreview, type ImportResult } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { STORAGE, type Storage } from '../../../integrations/storage/storage';
import type { CrmCtx } from '../shared/crm-access';
import { buildWorkbook, parseSpreadsheet } from './spreadsheet';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPE_ALIASES: Record<string, 'client' | 'owner' | 'partner'> = { client: 'client', კლიენტი: 'client', owner: 'owner', მესაკუთრე: 'owner', partner: 'partner', პარტნიორი: 'partner' };

@Injectable()
export class ImportsService {
  constructor(
    private readonly dbs: DbService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  private key(orgId: string, token: string) {
    if (!/^[0-9a-f-]{36}\.(xlsx|csv)$/i.test(token)) throw problems.badRequest('ფაილის ტოკენი არასწორია');
    return `imports/${orgId}/${token}`;
  }

  async preview(ctx: CrmCtx, file: { buffer: Buffer; originalname: string; size: number } | undefined): Promise<ImportPreview> {
    if (!file?.buffer?.length) throw problems.badRequest('ფაილი არ არის ატვირთული');
    if (file.size > MAX_BYTES) throw problems.badRequest('ფაილი 5 მბ-ზე დიდია');
    const ext = /\.csv$/i.test(file.originalname) ? 'csv' : /\.xlsx$/i.test(file.originalname) ? 'xlsx' : null;
    if (!ext) throw problems.badRequest('დაშვებულია მხოლოდ XLSX და CSV ფაილები');
    let rows: string[][];
    try {
      rows = await parseSpreadsheet(file.buffer, file.originalname);
    } catch {
      throw problems.badRequest('ფაილის წაკითხვა ვერ მოხერხდა');
    }
    if (rows.length < 2) throw problems.badRequest('ფაილში სათაურების ხაზი და მინიმუმ ერთი ხაზი უნდა იყოს');
    const token = `${uuidv7()}.${ext}`;
    await this.storage.put(this.key(ctx.orgId, token), file.buffer, ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const headers = rows[0]!.map((h, i) => h || `სვეტი ${i + 1}`);
    const suggested: Record<string, ImportField> = {};
    const used = new Set<ImportField>();
    for (const h of headers) {
      const f = suggestImportField(h);
      if (f && !used.has(f)) {
        suggested[h] = f;
        used.add(f);
      }
    }
    return { fileToken: token, fileName: file.originalname, headers, rows: rows.slice(1, 21), rowsTotal: rows.length - 1, suggested };
  }

  /** Google Sheets: public link → CSV export → same preview flow. */
  async previewSheets(ctx: CrmCtx, url: string) {
    const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) throw problems.badRequest('Google Sheets-ის ბმული არასწორია');
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
    const exportUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    let buf: Buffer;
    try {
      const res = await fetch(exportUrl, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
      if (!res.ok) throw new Error(String(res.status));
      buf = Buffer.from(await res.arrayBuffer());
    } catch {
      throw problems.badRequest('ცხრილი ვერ ჩამოიტვირთა — გახსენით წვდომა „ბმულით ყველასთვის“');
    }
    return this.preview(ctx, { buffer: buf, originalname: 'google-sheets.csv', size: buf.length });
  }

  async commit(ctx: CrmCtx, input: { fileToken: string; mapping: Record<string, ImportField>; dryRun: boolean }): Promise<ImportResult> {
    const buf = await this.storage.get(this.key(ctx.orgId, input.fileToken));
    if (!buf) throw problems.notFound('ატვირთული ფაილი');
    const rows = await parseSpreadsheet(buf, input.fileToken);
    const headers = rows[0]!.map((h, i) => h || `სვეტი ${i + 1}`);
    const colOf = new Map<ImportField, number[]>();
    for (const [header, field] of Object.entries(input.mapping)) {
      const idx = headers.indexOf(header);
      if (idx >= 0) colOf.set(field, [...(colOf.get(field) ?? []), idx]);
    }
    if (!colOf.has('name')) throw problems.badRequest('სვეტი „სახელი“ აუცილებლად უნდა მიეთითოს');
    const data = rows.slice(1, MAX_ROWS + 1);
    const errors: { row: number; message: string }[] = [];
    const values: (typeof crmContacts.$inferInsert)[] = [];
    const get = (r: string[], f: ImportField) => (colOf.get(f) ?? []).map((i) => r[i] ?? '').filter(Boolean);

    return this.dbs.org(ctx.orgId, async (tx) => {
      const existing = await tx.select({ phones: crmContacts.phones }).from(crmContacts).where(and(isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId)));
      const seen = new Set(existing.flatMap((c) => c.phones.map((p) => normalizePhone(p)).filter((p): p is string => !!p)));
      data.forEach((r, i) => {
        const rowNo = i + 2; // spreadsheet row number (1 = headers)
        const name = get(r, 'name').join(' ').trim();
        if (!name) return errors.push({ row: rowNo, message: 'სახელი ცარიელია' });
        const rawPhones = get(r, 'phone').flatMap((p) => p.split(/[,;/]/)).map((p) => p.trim()).filter(Boolean);
        const phones: string[] = [];
        for (const p of rawPhones) {
          const n = normalizePhone(p);
          if (!n) return errors.push({ row: rowNo, message: `ტელეფონის ნომერი არასწორია: ${p}` });
          phones.push(n);
        }
        if (phones.some((p) => seen.has(p))) return errors.push({ row: rowNo, message: `დუბლიკატი: ${phones.find((p) => seen.has(p))} უკვე არის ბაზაში` });
        const emails = get(r, 'email').flatMap((e) => e.split(/[,;]/)).map((e) => e.trim()).filter(Boolean);
        const badEmail = emails.find((e) => !EMAIL.test(e));
        if (badEmail) return errors.push({ row: rowNo, message: `ელ-ფოსტა არასწორია: ${badEmail}` });
        const typeRaw = get(r, 'type')[0]?.toLowerCase();
        const type = typeRaw ? TYPE_ALIASES[typeRaw] : 'client';
        if (!type) return errors.push({ row: rowNo, message: `ტიპი არასწორია: ${typeRaw}` });
        phones.forEach((p) => seen.add(p));
        values.push({
          orgId: ctx.orgId,
          name: name.slice(0, 160),
          type,
          phones: [...new Set(phones)],
          emails,
          company: get(r, 'company')[0]?.slice(0, 160) ?? null,
          tags: get(r, 'tags').flatMap((t) => t.split(/[,;]/)).map((t) => t.trim()).filter(Boolean).slice(0, 30),
          source: get(r, 'source')[0]?.slice(0, 60) ?? 'import',
          notes: get(r, 'notes').join('\n') || null,
          ownerAgentId: ctx.role === 'agent' ? ctx.userId : null,
        });
      });
      if (input.dryRun) return { id: null, rowsTotal: data.length, rowsImported: values.length, errors, status: 'done', dryRun: true };
      for (let i = 0; i < values.length; i += 500) await tx.insert(crmContacts).values(values.slice(i, i + 500));
      const [rec] = await tx
        .insert(crmImports)
        .values({ orgId: ctx.orgId, createdBy: ctx.userId, fileName: input.fileToken, mapping: input.mapping, status: values.length || !data.length ? 'done' : 'failed', rowsTotal: data.length, rowsImported: values.length, errors })
        .returning();
      return { id: rec!.id, rowsTotal: data.length, rowsImported: values.length, errors, status: rec!.status as 'done' | 'failed', dryRun: false };
    });
  }

  history(ctx: CrmCtx) {
    return this.dbs.org(ctx.orgId, (tx) => tx.select().from(crmImports).where(isNull(crmImports.deletedAt)).orderBy(desc(crmImports.createdAt)).limit(50));
  }

  /** Full data export (C24). Agents export only their own rows; finance columns need `finance.view`. */
  async export(ctx: CrmCtx, entity: ExportEntity, format: 'xlsx' | 'csv') {
    const finance = crmCan(ctx.role, 'finance.view');
    const names = async (ids: (string | null)[]) => {
      const u = [...new Set(ids.filter((x): x is string => !!x))];
      const rows = u.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, u)) : [];
      return new Map(rows.map((r) => [r.id, r.name ?? '']));
    };
    const date = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '');
    return this.dbs.org(ctx.orgId, async (tx) => {
      if (entity === 'contacts') {
        const rows = await tx.select().from(crmContacts).where(and(isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId), ctx.ownContactsOnly ? eq(crmContacts.ownerAgentId, ctx.userId) : undefined)).orderBy(crmContacts.createdAt);
        const n = await names(rows.map((r) => r.ownerAgentId));
        return buildWorkbook('კონტაქტები', ['ID', 'სახელი', 'ტიპი', 'კომპანია', 'ტელეფონები', 'ელ-ფოსტა', 'თეგები', 'წყარო', 'აგენტი', 'შენიშვნა', 'შექმნის თარიღი'], rows.map((r) => [r.id, r.name, r.type, r.company, r.phones.join(', '), r.emails.join(', '), r.tags.join(', '), r.source, n.get(r.ownerAgentId ?? '') ?? '', r.notes, date(r.createdAt)]), format);
      }
      if (entity === 'deals') {
        const rows = await tx.select().from(crmDeals).where(and(isNull(crmDeals.deletedAt), ctx.ownDealsOnly ? eq(crmDeals.agentId, ctx.userId) : undefined)).orderBy(crmDeals.createdAt);
        const n = await names(rows.map((r) => r.agentId));
        const headers = ['ID', 'სათაური', 'ეტაპი', 'კონტაქტის ID', 'ფართის ID', 'აგენტი', 'წყარო', 'უარის მიზეზი', 'შექმნის თარიღი', 'დახურვის თარიღი'];
        if (finance) headers.push('ღირებულება, ₾', 'კომისია, %', 'კომისია, ₾', 'აგენტის წილი, %');
        return buildWorkbook('გარიგებები', headers, rows.map((r) => [r.id, r.title, r.stage, r.contactId, r.listingId, n.get(r.agentId ?? '') ?? '', r.source, r.lostReason, date(r.createdAt), date(r.closedAt), ...(finance ? [r.valueMinor / 100, Number(r.commissionPct), r.commissionMinor / 100, Number(r.agentSharePct)] : [])]), format);
      }
      const rows = await tx.select().from(crmTasks).where(and(isNull(crmTasks.deletedAt), ctx.role === 'agent' ? eq(crmTasks.assigneeId, ctx.userId) : undefined)).orderBy(crmTasks.createdAt);
      const n = await names(rows.map((r) => r.assigneeId));
      return buildWorkbook('დავალებები', ['ID', 'სათაური', 'ვადა', 'პრიორიტეტი', 'შემსრულებელი', 'შესრულდა', 'გარიგების ID', 'კონტაქტის ID'], rows.map((r) => [r.id, r.title, date(r.dueAt), r.priority, n.get(r.assigneeId ?? '') ?? '', date(r.doneAt), r.dealId, r.contactId]), format);
    });
  }
}

export const IMPORT_FIELD_LIST = IMPORT_FIELDS;
