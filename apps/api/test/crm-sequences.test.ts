import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crmContacts, crmDeals, crmSequenceRuns, eq, sql } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES, sys } from './crm-helpers';
import { SMS } from '../src/integrations/sms/sms';
import type { MockSms } from '../src/integrations/sms/sms.mock';
import { CrmEventsService } from '../src/modules/crm/shared/crm-events.service';

describe('CRM follow-up sequences (C16) — runs on schedule', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  let sms: MockSms;
  beforeAll(async () => {
    ctx = await createApp();
    sms = ctx.app.get(SMS) as MockSms;
  });
  afterAll(async () => ctx.app.close());

  async function freshContact(orgId: string, phone: string, name = 'გიორგი ტესტი') {
    const [c] = await sys(ctx.db, (tx) => tx.insert(crmContacts).values({ orgId, name, phones: [phone] }).returning());
    return c!;
  }

  it('sends step 0 now, step 2 after two days, then completes', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const seq = await manager.post('/v1/crm/sequences').send({ name: 'ტესტი', trigger: 'manual', steps: [{ delayDays: 0, channel: 'sms', template: 'გამარჯობა {name}! {org}' }, { delayDays: 2, channel: 'sms', template: 'ისევ ეძებთ ფართს, {name}?' }] });
    expect(seq.status).toBe(201);
    const contact = await freshContact(manager.orgId, '+995599100200', 'ლაშა ბერიძე');
    const run = await manager.post(`/v1/crm/sequences/${seq.body.id}/enroll`).send({ contactId: contact.id });
    expect(run.status).toBe(201);
    await ctx.queue.drain();
    await ctx.queue.runNow('crm.sequences.run');
    const toContact = () => sms.outbox.filter((m) => m.to === '+995599100200');
    expect(toContact().map((m) => m.text)).toEqual(['გამარჯობა ლაშა! ქალაქის ფართები']);
    let [row] = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.id, run.body.id)));
    expect(row).toMatchObject({ step: 1, status: 'running' });
    expect(row!.nextAt!.getTime()).toBeGreaterThan(Date.now() + 86_400_000);
    // nothing due yet
    await ctx.queue.runNow('crm.sequences.run');
    expect(toContact()).toHaveLength(1);
    // two days pass
    await sys(ctx.db, (tx) => tx.update(crmSequenceRuns).set({ nextAt: sql`now() - interval '1 minute'` }).where(eq(crmSequenceRuns.id, run.body.id)));
    await ctx.queue.runNow('crm.sequences.run');
    expect(toContact().map((m) => m.text)).toEqual(['გამარჯობა ლაშა! ქალაქის ფართები', 'ისევ ეძებთ ფართს, ლაშა?']);
    [row] = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.id, run.body.id)));
    expect(row).toMatchObject({ step: 2, status: 'done', nextAt: null });
    const tl = await manager.get(`/v1/crm/activities?entity=contact&entityId=${contact.id}`);
    expect(tl.body.filter((a: { type: string }) => a.type === 'sms')).toHaveLength(2);
    const runs = await manager.get(`/v1/crm/sequences/runs?sequenceId=${seq.body.id}`);
    expect(runs.body[0]).toMatchObject({ status: 'done', stepsTotal: 2 });
  });

  it('stops on client reply and on won deal', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const seq = await manager.post('/v1/crm/sequences').send({ name: 'შეჩერება', steps: [{ delayDays: 1, channel: 'sms', template: 'x' }] });
    const c1 = await freshContact(manager.orgId, '+995599100301');
    const r1 = await manager.post(`/v1/crm/sequences/${seq.body.id}/enroll`).send({ contactId: c1.id });
    await manager.post('/v1/crm/inbox/simulate').send({ channel: 'whatsapp', from: '+995599100301', text: 'მადლობა, უკვე ვიპოვე' });
    let [row] = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.id, r1.body.id)));
    expect(row!.status).toBe('stopped');

    const c2 = await freshContact(manager.orgId, '+995599100302');
    const [deal] = await sys(ctx.db, (tx) => tx.select().from(crmDeals).where(eq(crmDeals.orgId, manager.orgId)).limit(1));
    const r2 = await manager.post(`/v1/crm/sequences/${seq.body.id}/enroll`).send({ contactId: c2.id, dealId: deal!.id });
    await ctx.app.get(CrmEventsService).emit('deal.stage_changed', { orgId: manager.orgId, dealId: deal!.id, contactId: deal!.contactId, from: 'offer', to: 'won', kind: 'won', actorId: null });
    [row] = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.id, r2.body.id)));
    expect(row!.status).toBe('stopped');
  });

  it('new_lead trigger auto-enrolls new contacts; agents cannot edit sequences', async () => {
    const manager = await crmLogin(ctx.app, PHONES.agencyManager);
    const seq = await manager.post('/v1/crm/sequences').send({ name: 'ახალი ლიდი ტესტ', trigger: 'new_lead', steps: [{ delayDays: 0, channel: 'sms', template: 'მოგესალმებით, {name}!' }] });
    const c = await freshContact(manager.orgId, '+995599100400', 'მარიამ ლიდი');
    await ctx.app.get(CrmEventsService).emit('contact.created', { orgId: manager.orgId, contactId: c.id, actorId: manager.user.id, source: 'website' });
    await ctx.queue.drain();
    const runs = await sys(ctx.db, (tx) => tx.select().from(crmSequenceRuns).where(eq(crmSequenceRuns.contactId, c.id)));
    expect(runs.find((r) => r.sequenceId === seq.body.id)?.status).toBe('done');
    expect(sms.outbox.some((m) => m.to === '+995599100400' && m.text === 'მოგესალმებით, მარიამ!')).toBe(true);
    const agent = await crmLogin(ctx.app, PHONES.agent);
    expect((await agent.patch(`/v1/crm/sequences/${seq.body.id}`).send({ active: false })).status).toBe(403);
    const toggled = await manager.patch(`/v1/crm/sequences/${seq.body.id}`).send({ active: false });
    expect(toggled.body).toMatchObject({ active: false, name: 'ახალი ლიდი ტესტ' });
  });
});
