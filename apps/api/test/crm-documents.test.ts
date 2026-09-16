import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmDeals, eq, notifications } from '@lokacia/db';
import { SMS } from '../src/integrations/sms/sms';
import type { MockSms } from '../src/integrations/sms/sms.mock';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';

describe('CRM documents & e-sign (C21)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('fills a template, versions it, renders PDF, sends for signature and signs publicly', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const [deal] = await sys(ctx.db, (tx) => tx.select().from(crmDeals).where(eq(crmDeals.orgId, manager.orgId)).limit(1));
    const created = await manager.post('/v1/crm/documents').send({ template: 'exclusivity', dealId: deal!.id, fields: { termMonths: 3 } });
    expect(created.status).toBe(201);
    expect(created.body.version).toBe(1);
    expect(created.body.contactId).toBe(deal!.contactId);
    expect(created.body.text).toContain('3 თვე');
    expect(created.body.text).not.toContain('{{');

    const v2 = await manager.post(`/v1/crm/documents/${created.body.id}/versions`).send({ fields: { termMonths: 12 } });
    expect(v2.status).toBe(201);
    expect(v2.body).toMatchObject({ version: 2, parentId: created.body.id, rootId: created.body.id, versionsCount: 2 });
    expect(v2.body.text).toContain('12 თვე');
    const fromOld = await manager.post(`/v1/crm/documents/${created.body.id}/versions`).send({ fields: { termMonths: 1 } });
    expect(fromOld.status).toBe(409);

    const list = await manager.get(`/v1/crm/documents?dealId=${deal!.id}`);
    expect(list.body.map((d: { id: string }) => d.id)).toContain(v2.body.id);
    expect(list.body.map((d: { id: string }) => d.id)).not.toContain(created.body.id);

    const pdf = await manager.get(`/v1/crm/documents/${v2.body.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    expect((await assistant.post(`/v1/crm/documents/${v2.body.id}/send`).send({ signerName: 'ნინო ბერიძე', signerPhone: '555 12 34 56' })).status).toBe(403);

    const sent = await manager.post(`/v1/crm/documents/${v2.body.id}/send`).send({ signerName: 'ნინო ბერიძე', signerPhone: '555 12 34 56' });
    expect(sent.status).toBe(200);
    expect(sent.body.signStatus).toBe('sent');
    const sms = ctx.app.get<MockSms>(SMS);
    expect(sms.outbox.some((m) => m.to === '+995555123456' && m.text.includes(`/sign/${sent.body.signRef}`))).toBe(true);

    const view = await ctx.http().get(`/v1/crm/documents/sign/${sent.body.signRef}`);
    expect(view.status).toBe(200);
    expect(view.body.signStatus).toBe('sent');
    const signed = await ctx.http().post(`/v1/crm/documents/sign/${sent.body.signRef}`).send({ decision: 'sign', name: 'ნინო ბერიძე' });
    expect(signed.status).toBe(200);
    expect(signed.body.signStatus).toBe('signed');
    expect((await ctx.http().post(`/v1/crm/documents/sign/${sent.body.signRef}`).send({ decision: 'sign', name: 'x y' })).status).toBe(409);

    const notes = await ctx.db.select().from(notifications).where(eq(notifications.userId, manager.user.id));
    expect(notes.some((n) => n.template === 'crm_document_signed')).toBe(true);
    expect((await manager.post(`/v1/crm/documents/${v2.body.id}/versions`).send({ fields: { termMonths: 2 } })).status).toBe(409);
    expect((await ctx.http().get('/v1/crm/documents/sign/mock-sign-unknown')).status).toBe(404);
  });

  it('denies cross-org access', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const doc = await manager.post('/v1/crm/documents').send({ template: 'act', fields: {} });
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.get(`/v1/crm/documents/${doc.body.id}`)).status).toBe(404);
    expect((await other.get('/v1/crm/documents').set('x-org-id', manager.orgId)).status).toBe(403);
    expect((await other.get('/v1/crm/documents')).body.map((d: { id: string }) => d.id)).not.toContain(doc.body.id);
  });
});
