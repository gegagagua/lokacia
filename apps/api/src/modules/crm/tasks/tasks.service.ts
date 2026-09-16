import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, asc, crmContacts, crmDeals, crmTasks, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql, users, withSystem, type SQL, type Tx } from '@lokacia/db';
import type { z } from 'zod';
import { formatDateTimeKa, type CrmTask, type CrmTaskCounts, type taskSchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { ENV, type Env } from '../../../config/env';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import { assertCan, visibleContact, visibleDeal, type CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';

type Row = typeof crmTasks.$inferSelect;
type TaskInput = z.infer<typeof taskSchema>;
type View = 'today' | 'overdue' | 'upcoming' | 'done' | 'open';
const REMIND_AHEAD_MS = 15 * 60_000;

/** End of the current day in Tbilisi (UTC+4). */
function endOfTodayTbilisi(now = new Date()) {
  const local = new Date(now.getTime() + 4 * 3600_000);
  const day = local.toISOString().slice(0, 10);
  return new Date(new Date(`${day}T00:00:00+04:00`).getTime() + 24 * 3600_000);
}

@Injectable()
export class TasksService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
    private readonly events: CrmEventsService,
    private readonly queue: QueueService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('crm.tasks.remind', () => this.remindDue());
    this.queue.every('crm.tasks.remind', 60_000);
  }

  private viewWhere(view: View, now = new Date()): SQL {
    const eod = endOfTodayTbilisi(now);
    switch (view) {
      case 'done':
        return isNotNull(crmTasks.doneAt);
      case 'overdue':
        return and(isNull(crmTasks.doneAt), lt(crmTasks.dueAt, now))!;
      case 'today':
        return and(isNull(crmTasks.doneAt), gte(crmTasks.dueAt, now), lt(crmTasks.dueAt, eod))!;
      case 'upcoming':
        return and(isNull(crmTasks.doneAt), or(isNull(crmTasks.dueAt), gte(crmTasks.dueAt, eod)))!;
      default:
        return isNull(crmTasks.doneAt);
    }
  }

  private scope(ctx: CrmCtx, scope: 'mine' | 'all'): SQL[] {
    const where: SQL[] = [isNull(crmTasks.deletedAt)];
    if (scope === 'mine' || ctx.ownContactsOnly) where.push(eq(crmTasks.assigneeId, ctx.userId));
    return where;
  }

  async hydrate(tx: Tx, rows: Row[]): Promise<CrmTask[]> {
    const pick = (k: 'dealId' | 'contactId' | 'assigneeId') => [...new Set(rows.map((r) => r[k]).filter((x): x is string => !!x))];
    const deals = pick('dealId').length ? await tx.select({ id: crmDeals.id, title: crmDeals.title }).from(crmDeals).where(inArray(crmDeals.id, pick('dealId'))) : [];
    const contacts = pick('contactId').length ? await tx.select({ id: crmContacts.id, name: crmContacts.name }).from(crmContacts).where(inArray(crmContacts.id, pick('contactId'))) : [];
    const people = pick('assigneeId').length ? await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, pick('assigneeId'))) : [];
    const d = new Map(deals.map((x) => [x.id, x.title]));
    const c = new Map(contacts.map((x) => [x.id, x.name]));
    const u = new Map(people.map((x) => [x.id, x.name]));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt?.toISOString() ?? null,
      priority: r.priority,
      doneAt: r.doneAt?.toISOString() ?? null,
      remindedAt: r.remindedAt?.toISOString() ?? null,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeId ? (u.get(r.assigneeId) ?? null) : null,
      dealId: r.dealId,
      dealTitle: r.dealId ? (d.get(r.dealId) ?? null) : null,
      contactId: r.contactId,
      contactName: r.contactId ? (c.get(r.contactId) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async list(ctx: CrmCtx, q: { scope: 'mine' | 'all'; view: View; dealId?: string; contactId?: string }) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const where = [...this.scope(ctx, q.dealId || q.contactId ? 'all' : q.scope), this.viewWhere(q.view)];
      if (q.dealId) where.push(eq(crmTasks.dealId, q.dealId));
      if (q.contactId) where.push(eq(crmTasks.contactId, q.contactId));
      const order = q.view === 'done' ? [desc(crmTasks.doneAt)] : [sql`${crmTasks.dueAt} asc nulls last`, asc(crmTasks.createdAt)];
      const rows = await tx.select().from(crmTasks).where(and(...where)).orderBy(...order).limit(500);
      return this.hydrate(tx, rows);
    });
  }

  async counts(ctx: CrmCtx, scope: 'mine' | 'all'): Promise<CrmTaskCounts> {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const base = this.scope(ctx, scope);
      const count = async (v: View) => Number((await tx.select({ n: sql<number>`count(*)` }).from(crmTasks).where(and(...base, this.viewWhere(v))))[0]?.n ?? 0);
      return { today: await count('today'), overdue: await count('overdue'), upcoming: await count('upcoming'), done: await count('done') };
    });
  }

  private async find(tx: Tx, ctx: CrmCtx, id: string) {
    const where = [eq(crmTasks.id, id), isNull(crmTasks.deletedAt)];
    if (ctx.ownContactsOnly) where.push(eq(crmTasks.assigneeId, ctx.userId));
    const [row] = await tx.select().from(crmTasks).where(and(...where));
    if (!row) throw problems.notFound('დავალება');
    return row;
  }

  private async one(tx: Tx, row: Row) {
    return (await this.hydrate(tx, [row]))[0]!;
  }

  async create(ctx: CrmCtx, input: TaskInput) {
    const task = await this.dbs.org(ctx.orgId, async (tx) => {
      const assigneeId = ctx.ownContactsOnly ? ctx.userId : (input.assigneeId ?? ctx.userId);
      let contactId = input.contactId ?? null;
      // linked records must be visible to the caller (agents: own deals/contacts) — 404 otherwise
      const deal = input.dealId ? await visibleDeal(tx, ctx, input.dealId) : null;
      if (contactId && contactId !== deal?.contactId) await visibleContact(tx, ctx, contactId);
      contactId ??= deal?.contactId ?? null;
      const [row] = await tx
        .insert(crmTasks)
        .values({ orgId: ctx.orgId, title: input.title, dueAt: input.dueAt ? new Date(input.dueAt) : null, priority: input.priority, dealId: input.dealId ?? null, contactId, assigneeId })
        .returning();
      const payload = { taskId: row!.id, title: row!.title, body: row!.title, dueAt: row!.dueAt?.toISOString() ?? null };
      if (contactId) await this.activities.log(ctx.orgId, { entity: 'contact', entityId: contactId, type: 'task', payload, createdBy: ctx.userId }, tx);
      if (input.dealId) await this.activities.log(ctx.orgId, { entity: 'deal', entityId: input.dealId, type: 'task', payload, createdBy: ctx.userId }, tx);
      return this.one(tx, row!);
    });
    await this.events.emit('task.created', { orgId: ctx.orgId, taskId: task.id, assigneeId: task.assigneeId });
    return task;
  }

  async update(ctx: CrmCtx, id: string, patch: Partial<TaskInput>) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const before = await this.find(tx, ctx, id);
      const set: Partial<typeof crmTasks.$inferInsert> = {};
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.priority !== undefined) set.priority = patch.priority;
      if (patch.dueAt !== undefined) {
        set.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
        if (String(set.dueAt?.getTime()) !== String(before.dueAt?.getTime())) set.remindedAt = null;
      }
      if (patch.assigneeId !== undefined && !ctx.ownContactsOnly) set.assigneeId = patch.assigneeId;
      if (patch.dealId !== undefined && patch.dealId !== before.dealId) set.dealId = patch.dealId ? (await visibleDeal(tx, ctx, patch.dealId)).id : null;
      if (patch.contactId !== undefined && patch.contactId !== before.contactId) {
        const dealContact = set.dealId ? (await visibleDeal(tx, ctx, set.dealId)).contactId : null;
        set.contactId = patch.contactId && patch.contactId !== dealContact ? (await visibleContact(tx, ctx, patch.contactId)).id : patch.contactId;
      }
      const [row] = Object.keys(set).length ? await tx.update(crmTasks).set(set).where(eq(crmTasks.id, id)).returning() : [before];
      return this.one(tx, row!);
    });
  }

  async complete(ctx: CrmCtx, id: string, done: boolean) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      await this.find(tx, ctx, id);
      const [row] = await tx.update(crmTasks).set({ doneAt: done ? new Date() : null }).where(eq(crmTasks.id, id)).returning();
      return this.one(tx, row!);
    });
  }

  async snooze(ctx: CrmCtx, id: string, input: { minutes?: number; until?: string }) {
    if (!input.minutes && !input.until) throw problems.badRequest('მიუთითეთ minutes ან until');
    return this.dbs.org(ctx.orgId, async (tx) => {
      const t = await this.find(tx, ctx, id);
      const base = t.dueAt && t.dueAt > new Date() ? t.dueAt : new Date();
      const dueAt = input.until ? new Date(input.until) : new Date(base.getTime() + input.minutes! * 60_000);
      const [row] = await tx.update(crmTasks).set({ dueAt, remindedAt: null }).where(eq(crmTasks.id, id)).returning();
      return this.one(tx, row!);
    });
  }

  async remove(ctx: CrmCtx, id: string) {
    assertCan(ctx, 'records.delete');
    await this.dbs.org(ctx.orgId, async (tx) => {
      await this.find(tx, ctx, id);
      await tx.update(crmTasks).set({ deletedAt: new Date() }).where(eq(crmTasks.id, id));
    });
    return { ok: true };
  }

  /** Reminder job (C5): in-app + Telegram + push for tasks due within 15 minutes; `remindedAt` makes it once-only. */
  async remindDue(now = new Date()) {
    const due = await withSystem(this.dbs.db, async (tx) => {
      const rows = await tx
        .select()
        .from(crmTasks)
        .where(and(isNull(crmTasks.deletedAt), isNull(crmTasks.doneAt), isNull(crmTasks.remindedAt), isNotNull(crmTasks.assigneeId), lte(crmTasks.dueAt, new Date(now.getTime() + REMIND_AHEAD_MS))))
        .limit(500)
        .for('update', { skipLocked: true });
      if (rows.length) await tx.update(crmTasks).set({ remindedAt: now }).where(inArray(crmTasks.id, rows.map((r) => r.id)));
      return rows;
    });
    for (const t of due) {
      await this.notify.notify({
        userId: t.assigneeId,
        template: 'crm_task_reminder',
        vars: { title: t.title, when: t.dueAt ? formatDateTimeKa(t.dueAt) : '' },
        channels: ['in_app', 'telegram', 'push'],
        to: { push: t.assigneeId! },
        link: `${this.env.CRM_URL}/tasks`,
        category: 'crm',
      });
    }
    return { reminded: due.length };
  }
}
