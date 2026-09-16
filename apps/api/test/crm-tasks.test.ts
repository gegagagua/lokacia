import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, notifications, users } from '@lokacia/db';
import { createApp } from './helpers';
import { crmLogin, PHONES } from './crm-helpers';

describe('CRM tasks & reminders (C5)', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('lists today / overdue, completes and snoozes', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const inAnHour = new Date(Date.now() + 60 * 60_000);
    const today = inAnHour.getUTCHours() < 19 ? inAnHour : new Date(Date.now() + 60_000 * 5);
    const t1 = await agent.post('/v1/crm/tasks').send({ title: 'დაურეკე კლიენტს', dueAt: today.toISOString(), priority: 'high' });
    expect(t1.status).toBe(201);
    expect(t1.body.assigneeId).toBe(agent.user.id);
    const t2 = await agent.post('/v1/crm/tasks').send({ title: 'ვადაგადაცილებული', dueAt: new Date(Date.now() - 3 * 3600_000).toISOString() });
    const overdue = await agent.get('/v1/crm/tasks?view=overdue');
    expect(overdue.body.map((t: { id: string }) => t.id)).toContain(t2.body.id);
    const counts = await agent.get('/v1/crm/tasks/counts');
    expect(counts.body.overdue).toBeGreaterThan(0);
    const snoozed = await agent.post(`/v1/crm/tasks/${t2.body.id}/snooze`).send({ minutes: 60 * 24 * 3 });
    expect(new Date(snoozed.body.dueAt).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
    const done = await agent.post(`/v1/crm/tasks/${t1.body.id}/complete`);
    expect(done.body.doneAt).not.toBeNull();
    const doneList = await agent.get('/v1/crm/tasks?view=done');
    expect(doneList.body.map((t: { id: string }) => t.id)).toContain(t1.body.id);
    // assistants cannot delete (no records.delete), agents can
    const assistant = await crmLogin(ctx.app, PHONES.assistant);
    const t3 = await assistant.post('/v1/crm/tasks').send({ title: 'ასისტენტის დავალება' });
    expect((await assistant.delete(`/v1/crm/tasks/${t3.body.id}`)).status).toBe(403);
  });

  it('reminder job notifies in-app + Telegram once', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    await ctx.db.update(users).set({ telegramChatId: '700100' }).where(eq(users.id, agent.user.id));
    const t = await agent.post('/v1/crm/tasks').send({ title: 'შეხსენების ტესტი', dueAt: new Date(Date.now() + 5 * 60_000).toISOString() });
    await ctx.queue.runNow('crm.tasks.remind');
    await ctx.queue.drain();
    const rows = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, agent.user.id), eq(notifications.template, 'crm_task_reminder')));
    const mine = rows.filter((n) => (n.payload as { title?: string }).title === 'შეხსენების ტესტი');
    expect(mine.map((n) => n.channel).sort()).toEqual(['in_app', 'push', 'telegram']);
    expect(mine.find((n) => n.channel === 'telegram')?.to).toBe('700100');
    await ctx.queue.runNow('crm.tasks.remind');
    const again = (await ctx.db.select().from(notifications).where(and(eq(notifications.userId, agent.user.id), eq(notifications.template, 'crm_task_reminder')))).filter((n) => (n.payload as { title?: string }).title === 'შეხსენების ტესტი');
    expect(again.length).toBe(mine.length);
    // snooze resets the reminder
    await agent.post(`/v1/crm/tasks/${t.body.id}/snooze`).send({ minutes: 1 });
    await ctx.queue.runNow('crm.tasks.remind');
    const after = (await ctx.db.select().from(notifications).where(and(eq(notifications.userId, agent.user.id), eq(notifications.template, 'crm_task_reminder')))).filter((n) => (n.payload as { title?: string }).title === 'შეხსენების ტესტი');
    expect(after.length).toBeGreaterThan(mine.length);
  });

  it('other org cannot see tasks', async () => {
    const agent = await crmLogin(ctx.app, PHONES.agent);
    const t = await agent.post('/v1/crm/tasks').send({ title: 'საიდუმლო' });
    const other = await crmLogin(ctx.app, PHONES.agency2Manager);
    expect((await other.patch(`/v1/crm/tasks/${t.body.id}`).send({ title: 'x' })).status).toBe(404);
    const list = await other.get('/v1/crm/tasks?scope=all&view=open');
    expect(list.body.map((x: { id: string }) => x.id)).not.toContain(t.body.id);
  });
});
