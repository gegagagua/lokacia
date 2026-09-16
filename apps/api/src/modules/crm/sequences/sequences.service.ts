import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, asc, conversations, crmContacts, crmSequenceRuns, crmSequences, desc, eq, inArray, isNull, lte, organizations, or, sql, users, withSystem, type SQL, type Tx } from '@lokacia/db';
import { renderSequenceTemplate, type CrmSequence, type CrmSequenceRun, type SequenceInput } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { SMS, type SmsProvider } from '../../../integrations/sms/sms';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import { visibleContact, visibleDeal, type CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';

const DAY = 86_400_000;
type RunRow = typeof crmSequenceRuns.$inferSelect;
type SeqRow = typeof crmSequences.$inferSelect;

/**
 * C16 follow-up sequences. A run's `step` is the index of the next step to send; `nextAt` = enrollment time +
 * that step's `delayDays` (delays are cumulative from enrollment: 0, 3, 7 → day 0, day 3, day 7).
 */
@Injectable()
export class SequencesService implements OnModuleInit {
  private readonly logger = new Logger('CrmSequences');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly events: CrmEventsService,
    private readonly activities: ActivityService,
    private readonly notify: NotificationsService,
    @Inject(SMS) private readonly sms: SmsProvider,
  ) {}

  onModuleInit() {
    this.queue.register('crm.sequences.run', () => this.runDue());
    this.queue.every('crm.sequences.run', 60_000);
    this.events.on('contact.created', (e) => this.autoEnroll(e.orgId, 'new_lead', e.contactId, null));
    this.events.on('viewing.done', (e) => (e.contactId ? this.autoEnroll(e.orgId, 'after_viewing', e.contactId, e.dealId) : undefined));
    this.events.on('message.inbound', (e) => (e.contactId ? this.stopFor(e.orgId, { contactId: e.contactId }, 'reply') : undefined));
    this.events.on('deal.stage_changed', (e) => (e.kind === 'open' ? undefined : this.stopFor(e.orgId, { dealId: e.dealId, contactId: e.contactId }, e.kind)));
  }

  /* ---------- CRUD ---------- */

  async list(ctx: CrmCtx): Promise<CrmSequence[]> {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const rows = await tx.select().from(crmSequences).where(isNull(crmSequences.deletedAt)).orderBy(asc(crmSequences.createdAt));
      const stats = await tx
        .select({ id: crmSequenceRuns.sequenceId, status: crmSequenceRuns.status, n: sql<number>`count(*)::int` })
        .from(crmSequenceRuns)
        .where(isNull(crmSequenceRuns.deletedAt))
        .groupBy(crmSequenceRuns.sequenceId, crmSequenceRuns.status);
      const count = (id: string, s: string) => Number(stats.find((x) => x.id === id && x.status === s)?.n ?? 0);
      return rows.map((r) => ({ id: r.id, name: r.name, trigger: r.trigger, steps: r.steps, active: r.active, createdAt: r.createdAt.toISOString(), running: count(r.id, 'running'), done: count(r.id, 'done'), stopped: count(r.id, 'stopped') }));
    });
  }

  private async findSeq(tx: Tx, id: string) {
    const [row] = await tx.select().from(crmSequences).where(and(eq(crmSequences.id, id), isNull(crmSequences.deletedAt)));
    if (!row) throw problems.notFound('ავტომატური შეტყობინება');
    return row;
  }

  async create(ctx: CrmCtx, input: SequenceInput) {
    const [row] = await this.dbs.org(ctx.orgId, (tx) => tx.insert(crmSequences).values({ orgId: ctx.orgId, ...input }).returning());
    return row;
  }

  async update(ctx: CrmCtx, id: string, patch: Partial<SequenceInput>) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      await this.findSeq(tx, id);
      const [row] = await tx.update(crmSequences).set(patch).where(eq(crmSequences.id, id)).returning();
      return row;
    });
  }

  async remove(ctx: CrmCtx, id: string) {
    await this.dbs.org(ctx.orgId, async (tx) => {
      await this.findSeq(tx, id);
      await tx.update(crmSequences).set({ deletedAt: new Date(), active: false }).where(eq(crmSequences.id, id));
      await tx.update(crmSequenceRuns).set({ status: 'stopped', nextAt: null }).where(and(eq(crmSequenceRuns.sequenceId, id), eq(crmSequenceRuns.status, 'running')));
    });
    return { ok: true };
  }

  /* ---------- runs ---------- */

  async runs(ctx: CrmCtx, q: { sequenceId?: string; contactId?: string; status?: string }): Promise<CrmSequenceRun[]> {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const where: SQL[] = [isNull(crmSequenceRuns.deletedAt)];
      if (q.sequenceId) where.push(eq(crmSequenceRuns.sequenceId, q.sequenceId));
      if (q.contactId) where.push(eq(crmSequenceRuns.contactId, q.contactId));
      if (q.status) where.push(eq(crmSequenceRuns.status, q.status as RunRow['status']));
      if (ctx.ownContactsOnly) where.push(sql`${crmSequenceRuns.contactId} IN (SELECT id FROM crm_contacts WHERE owner_agent_id = ${ctx.userId})`);
      const rows = await tx
        .select({ r: crmSequenceRuns, name: crmSequences.name, steps: crmSequences.steps, contactName: crmContacts.name })
        .from(crmSequenceRuns)
        .innerJoin(crmSequences, eq(crmSequences.id, crmSequenceRuns.sequenceId))
        .leftJoin(crmContacts, eq(crmContacts.id, crmSequenceRuns.contactId))
        .where(and(...where))
        .orderBy(desc(crmSequenceRuns.createdAt))
        .limit(500);
      return rows.map(({ r, name, steps, contactName }) => ({
        id: r.id,
        sequenceId: r.sequenceId,
        sequenceName: name,
        contactId: r.contactId,
        contactName,
        dealId: r.dealId,
        step: r.step,
        stepsTotal: steps.length,
        nextAt: r.nextAt?.toISOString() ?? null,
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  private async enrollTx(tx: Tx, orgId: string, seq: SeqRow, contactId: string, dealId: string | null) {
    const existing = await tx.query.crmSequenceRuns.findFirst({ where: and(eq(crmSequenceRuns.sequenceId, seq.id), eq(crmSequenceRuns.contactId, contactId), eq(crmSequenceRuns.status, 'running'), isNull(crmSequenceRuns.deletedAt)) });
    if (existing) return { run: existing, created: false };
    const now = new Date();
    const [run] = await tx
      .insert(crmSequenceRuns)
      .values({ orgId, sequenceId: seq.id, contactId, dealId, step: 0, nextAt: new Date(now.getTime() + (seq.steps[0]?.delayDays ?? 0) * DAY), status: 'running', createdAt: now })
      .returning();
    await this.activities.log(orgId, { entity: 'contact', entityId: contactId, type: 'sequence', payload: { sequenceId: seq.id, runId: run!.id, body: `ჩართულია: ${seq.name}` } }, tx);
    return { run: run!, created: true };
  }

  async enroll(ctx: CrmCtx, sequenceId: string, contactId: string, dealId: string | null) {
    const res = await this.dbs.org(ctx.orgId, async (tx) => {
      const seq = await this.findSeq(tx, sequenceId);
      await visibleContact(tx, ctx, contactId);
      if (dealId) await visibleDeal(tx, ctx, dealId);
      return this.enrollTx(tx, ctx.orgId, seq, contactId, dealId);
    });
    // a zero-delay first step goes out right away (queued, not inline)
    if (res.created && res.run.nextAt && res.run.nextAt <= new Date()) await this.queue.add('crm.sequences.run', {});
    return res.run;
  }

  async stopRun(ctx: CrmCtx, runId: string) {
    const [row] = await this.dbs.org(ctx.orgId, (tx) => tx.update(crmSequenceRuns).set({ status: 'stopped', nextAt: null }).where(and(eq(crmSequenceRuns.id, runId), eq(crmSequenceRuns.status, 'running'), ctx.ownContactsOnly ? sql`${crmSequenceRuns.contactId} IN (SELECT id FROM crm_contacts WHERE owner_agent_id = ${ctx.userId})` : undefined)).returning());
    if (!row) throw problems.notFound('ჩართვა');
    return row;
  }

  private async autoEnroll(orgId: string, trigger: 'new_lead' | 'after_viewing', contactId: string, dealId: string | null) {
    const created = await this.dbs.org(orgId, async (tx) => {
      const seqs = await tx.select().from(crmSequences).where(and(eq(crmSequences.trigger, trigger), eq(crmSequences.active, true), isNull(crmSequences.deletedAt)));
      let n = 0;
      for (const s of seqs) if ((await this.enrollTx(tx, orgId, s, contactId, dealId)).created) n++;
      return n;
    });
    if (created) await this.queue.add('crm.sequences.run', {});
  }

  private async stopFor(orgId: string, by: { contactId?: string | null; dealId?: string | null }, reason: string) {
    const cond: SQL[] = [];
    if (by.contactId) cond.push(eq(crmSequenceRuns.contactId, by.contactId));
    if (by.dealId) cond.push(eq(crmSequenceRuns.dealId, by.dealId));
    if (!cond.length) return;
    const stopped = await this.dbs.org(orgId, (tx) => tx.update(crmSequenceRuns).set({ status: 'stopped', nextAt: null }).where(and(eq(crmSequenceRuns.status, 'running'), or(...cond))).returning());
    for (const r of stopped) await this.activities.log(orgId, { entity: 'contact', entityId: r.contactId, type: 'sequence', payload: { runId: r.id, stopped: reason, body: reason === 'reply' ? 'შეჩერდა: კლიენტმა უპასუხა' : reason === 'won' ? 'შეჩერდა: გარიგება მოგებულია' : 'შეჩერდა: გარიგება დაიხურა' } });
  }

  /** Scheduler: sends every due step (SMS via provider; email/Telegram via notifications router). */
  async runDue(now = new Date()) {
    return withSystem(this.dbs.db, async (tx) => {
      const due = await tx.select().from(crmSequenceRuns).where(and(eq(crmSequenceRuns.status, 'running'), isNull(crmSequenceRuns.deletedAt), lte(crmSequenceRuns.nextAt, now))).orderBy(asc(crmSequenceRuns.nextAt)).limit(200).for('update', { skipLocked: true });
      if (!due.length) return { sent: 0, skipped: 0, done: 0 };
      const seqs = await tx.select().from(crmSequences).where(inArray(crmSequences.id, [...new Set(due.map((r) => r.sequenceId))]));
      const contacts = await tx.select().from(crmContacts).where(inArray(crmContacts.id, [...new Set(due.map((r) => r.contactId))]));
      const orgs = await tx.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, [...new Set(due.map((r) => r.orgId))]));
      const agentIds = [...new Set(contacts.map((c) => c.ownerAgentId).filter((x): x is string => !!x))];
      const agents = agentIds.length ? await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, agentIds)) : [];
      let sent = 0;
      let skipped = 0;
      let done = 0;
      for (const run of due) {
        const seq = seqs.find((s) => s.id === run.sequenceId);
        const contact = contacts.find((c) => c.id === run.contactId);
        if (!seq || seq.deletedAt || !seq.active || !contact || contact.deletedAt || contact.mergedIntoId) {
          await tx.update(crmSequenceRuns).set({ status: 'stopped', nextAt: null }).where(eq(crmSequenceRuns.id, run.id));
          continue;
        }
        const step = seq.steps[run.step];
        if (!step) {
          await tx.update(crmSequenceRuns).set({ status: 'done', nextAt: null }).where(eq(crmSequenceRuns.id, run.id));
          done++;
          continue;
        }
        const text = renderSequenceTemplate(step.template, {
          name: contact.name.split(' ')[0],
          agent: agents.find((a) => a.id === contact.ownerAgentId)?.name ?? '',
          org: orgs.find((o) => o.id === run.orgId)?.name ?? 'lokacia.ge',
        });
        let delivered = false;
        let to: string | null = null;
        try {
          if (step.channel === 'sms') {
            to = contact.phones[0] ?? null;
            if (to) {
              await this.sms.send(to, text);
              delivered = true;
            }
          } else {
            if (step.channel === 'email') to = contact.emails[0] ?? null;
            else {
              const [conv] = await tx.select({ externalId: conversations.externalId }).from(conversations).where(and(eq(conversations.contactId, contact.id), eq(conversations.channel, 'telegram'))).limit(1);
              to = conv?.externalId ?? null;
            }
            if (to) {
              await this.notify.notify({ template: 'crm_sequence_message', vars: { title: orgs.find((o) => o.id === run.orgId)?.name ?? 'lokacia.ge', body: text }, channels: [step.channel], to: { [step.channel]: to }, category: 'crm' });
              delivered = true;
            }
          }
        } catch (e) {
          this.logger.warn(`run ${run.id} step ${run.step} failed: ${(e as Error).message}`);
        }
        if (delivered) sent++;
        else skipped++;
        await tx.execute(sql`select set_config('app.org_id', ${run.orgId}, true)`);
        await this.activities.log(run.orgId, { entity: 'contact', entityId: contact.id, type: step.channel === 'email' ? 'email' : step.channel === 'sms' ? 'sms' : 'sequence', payload: { runId: run.id, sequenceId: seq.id, step: run.step, channel: step.channel, to, delivered, body: delivered ? text : `${text} (ადრესატი არ არის — გაიცდა)` } }, tx);
        const nextIdx = run.step + 1;
        const next = seq.steps[nextIdx];
        await tx
          .update(crmSequenceRuns)
          .set(next ? { step: nextIdx, lastRunAt: now, nextAt: new Date(Math.max(run.createdAt.getTime() + next.delayDays * DAY, now.getTime())) } : { step: nextIdx, lastRunAt: now, nextAt: null, status: 'done' })
          .where(eq(crmSequenceRuns.id, run.id));
        if (!next) done++;
        if (delivered && step.channel === 'sms') await tx.update(crmContacts).set({ lastContactedAt: now }).where(eq(crmContacts.id, contact.id));
      }
      return { sent, skipped, done };
    });
  }
}
