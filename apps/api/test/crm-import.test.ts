import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmImports, eq } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

const binary = (res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('CRM import / export (C24)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('imports an xlsx with column mapping, reports row errors and skips duplicates', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [existing] = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.orgId, manager.orgId)).limit(1));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('clients');
    ws.addRow(['სახელი', 'ტელეფონი', 'ელ-ფოსტა', 'კომპანია', 'თეგები', 'Column X']);
    ws.addRow(['ლევან იმპორტაძე', '599 11 22 33', 'levan@example.ge', 'შპს ტესტ', 'VIP, HoReCa', 'x']);
    ws.addRow(['', '599 11 22 34', '', '', '', '']);
    ws.addRow(['ცუდი ნომერი', '12', '', '', '', '']);
    ws.addRow(['დუბლიკატი', existing!.phones[0]!, '', '', '', '']);
    ws.addRow(['ცუდი ფოსტა', '599 11 22 35', 'not-an-email', '', '', '']);
    ws.addRow(['მარიამ იმპორტაძე', '+995 599 11 22 36', '', '', '', '']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const preview = await manager.post('/v1/crm/imports/preview').attach('file', buf, 'clients.xlsx');
    expect(preview.status).toBe(201);
    expect(preview.body.rowsTotal).toBe(6);
    expect(preview.body.suggested).toMatchObject({ სახელი: 'name', ტელეფონი: 'phone', 'ელ-ფოსტა': 'email', კომპანია: 'company', თეგები: 'tags' });

    const dry = await manager.post('/v1/crm/imports').send({ fileToken: preview.body.fileToken, mapping: preview.body.suggested, dryRun: true });
    expect(dry.body).toMatchObject({ dryRun: true, rowsImported: 2 });

    const res = await manager.post('/v1/crm/imports').send({ fileToken: preview.body.fileToken, mapping: preview.body.suggested });
    expect(res.status).toBe(201);
    expect(res.body.rowsImported).toBe(2);
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([3, 4, 5, 6]);
    expect(res.body.errors.find((e: { row: number }) => e.row === 5).message).toContain('დუბლიკატი');

    const rows = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.name, 'ლევან იმპორტაძე')));
    expect(rows[0]).toMatchObject({ phones: ['+995599112233'], emails: ['levan@example.ge'], tags: ['VIP', 'HoReCa'], company: 'შპს ტესტ' });
    const rec = await sys(ctx.db, (tx) => tx.select().from(crmImports).where(eq(crmImports.id, res.body.id)));
    expect(rec[0]).toMatchObject({ rowsTotal: 6, rowsImported: 2, status: 'done' });

    const cross = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await cross.post('/v1/crm/imports').send({ fileToken: preview.body.fileToken, mapping: preview.body.suggested })).status).toBe(404);
  });

  it('imports a semicolon CSV', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const csv = 'Name;Phone;Type\nგიორგი ცსვ;577 00 00 01;owner\n';
    const preview = await manager.post('/v1/crm/imports/preview').attach('file', Buffer.from(csv), 'people.csv');
    expect(preview.body.suggested).toEqual({ Name: 'name', Phone: 'phone', Type: 'type' });
    const res = await manager.post('/v1/crm/imports').send({ fileToken: preview.body.fileToken, mapping: preview.body.suggested });
    expect(res.body.rowsImported).toBe(1);
    const rows = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.name, 'გიორგი ცსვ')));
    expect(rows[0]).toMatchObject({ type: 'owner', phones: ['+995577000001'] });
  });

  it('exports contacts/deals; agent exports only own rows; assistant has no finance columns and no export', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const xlsx = await manager.get('/v1/crm/exports/contacts.xlsx').buffer(true).parse(binary as never);
    expect(xlsx.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.body as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(1).getCell(2).value).toBe('სახელი');
    const all = ws.rowCount - 1;

    const agent = await crmLogin(ctx.app, PHONES.agent);
    const own = await sys(ctx.db, (tx) => tx.select().from(crmContacts).where(eq(crmContacts.ownerAgentId, agent.user.id)));
    const agentCsv = await agent.get('/v1/crm/exports/contacts.csv');
    const lines = agentCsv.text.trim().split('\n').length - 1;
    expect(lines).toBeLessThan(all);
    expect(lines).toBe(own.filter((c) => !c.deletedAt && !c.mergedIntoId && c.orgId === agent.orgId).length);

    const deals = await manager.get('/v1/crm/exports/deals.csv');
    expect(deals.text).toContain('კომისია, ₾');
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.get('/v1/crm/exports/deals.csv')).status).toBe(403);
    expect((await manager.get('/v1/crm/exports/secrets.csv')).status).toBe(404);
  });
});
