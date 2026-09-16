import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { and, asc, crmActivities, crmContacts, crmDeals, crmPipelines, desc, eq, inArray, isNull, listings, ne, sql, users, type Tx } from '@lokacia/db';
import { dealFinance, dealSchema, stageProbabilityPct, type DealCard, type dealBoardQuerySchema, type dealMoveSchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems, ProblemException } from '../../../common/problem';
import { ListingReadService } from '../../listings/listing-read.service';
import { ActivityService } from '../shared/activity.service';
import { assertCan, usableListing, visibleContact, type CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';
import { PipelineService, type PipelineRow } from './pipeline.service';

type DealRow = typeof crmDeals.$inferSelect;
export const dealPatchSchema = dealSchema.partial().omit({ stage: true, pipelineId: true });
type DealPatch = z.infer<typeof dealPatchSchema>;
const DAY = 86_400_000;

const FINANCE_KEYS = ['valueMinor', 'commissionPct', 'agentSharePct'] as const;

@Injectable()
export class DealsService {
  constructor(
    private readonly dbs: DbService,
    private readonly pipelines: PipelineService,
    private readonly activities: ActivityService,
    private readonly events: CrmEventsService,
    private readonly read: ListingReadService,
  ) {}

  /** Pass `tx` when called inside a transaction: a second pool connection per request deadlocks the pool under load. */
  private async names(ids: (string | null)[], tx?: Tx) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map<string, string | null>();
    const rows = await (tx ?? this.dbs.db).select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, uniq));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toCard(d: DealRow, extra: { contactName: string | null; contactPhone: string | null; listingTitle: string | null; listingAddress: string | null; agentName: string | null }, finance: boolean, now = Date.now()): DealCard {
    return {
      id: d.id,
      title: d.title,
      stage: d.stage,
      position: d.position,
      contactId: d.contactId,
      listingId: d.listingId,
      agentId: d.agentId,
      source: d.source,
      valueMinor: finance ? d.valueMinor : null,
      commissionPct: finance ? d.commissionPct : null,
      commissionMinor: finance ? d.commissionMinor : null,
      agentSharePct: finance ? d.agentSharePct : null,
      lostReason: d.lostReason,
      expectedCloseAt: d.expectedCloseAt?.toISOString() ?? null,
      closedAt: d.closedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      stageChangedAt: d.stageChangedAt.toISOString(),
      daysInStage: Math.max(0, Math.floor((now - d.stageChangedAt.getTime()) / DAY)),
      ...extra,
    };
  }

  /** Kanban board of the default pipeline. Agents see only their deals; finance hidden without `finance.view`. */
  async board(ctx: CrmCtx, q: z.infer<typeof dealBoardQuerySchema>) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const p = await this.pipelines.defaultIn(tx, ctx.orgId);
      const where = [eq(crmDeals.pipelineId, p.id), isNull(crmDeals.deletedAt)];
      if (ctx.ownDealsOnly) where.push(eq(crmDeals.agentId, ctx.userId));
      else if (q.agentId) where.push(eq(crmDeals.agentId, q.agentId));
      if (q.source) where.push(eq(crmDeals.source, q.source));
      if (q.contactId) where.push(eq(crmDeals.contactId, q.contactId));
      if (q.listingId) where.push(eq(crmDeals.listingId, q.listingId));
      if (q.q) {
        const like = `%${q.q.replace(/[%_]/g, '')}%`;
        where.push(sql`(${crmDeals.title} ILIKE ${like} OR ${crmContacts.name} ILIKE ${like})`);
      }
      const rows = await tx
        .select({ d: crmDeals, contactName: crmContacts.name, contactPhones: crmContacts.phones, listingTitle: listings.title, listingAddress: listings.address })
        .from(crmDeals)
        .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
        .leftJoin(listings, eq(listings.id, crmDeals.listingId))
        .where(and(...where))
        .orderBy(asc(crmDeals.position), desc(crmDeals.updatedAt))
        .limit(2000);
      const names = await this.names(rows.map((r) => r.d.agentId), tx);
      const finance = ctx.can('finance.view');
      const now = Date.now();
      return {
        pipeline: { id: p.id, name: p.name, stages: p.stages },
        financeVisible: finance,
        deals: rows.map((r) =>
          this.toCard(r.d, { contactName: r.contactName, contactPhone: r.contactPhones?.[0] ?? null, listingTitle: r.listingTitle, listingAddress: r.listingAddress, agentName: r.d.agentId ? (names.get(r.d.agentId) ?? null) : null }, finance, now),
        ),
      };
    });
  }

  private async findVisible(tx: Tx, ctx: CrmCtx, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('გარიგება');
    const d = await tx.query.crmDeals.findFirst({ where: and(eq(crmDeals.id, id), isNull(crmDeals.deletedAt)) });
    if (!d || (ctx.ownDealsOnly && d.agentId !== ctx.userId)) throw problems.notFound('გარიგება');
    return d;
  }

  async create(ctx: CrmCtx, input: z.infer<typeof dealSchema>) {
    const deal = await this.dbs.org(ctx.orgId, async (tx) => {
      const contact = await visibleContact(tx, ctx, input.contactId);
      if (input.listingId) await usableListing(tx, ctx, input.listingId);
      const p = await this.pipelines.defaultIn(tx, ctx.orgId);
      const stage = input.stage ? PipelineService.stage(p, input.stage) : PipelineService.firstOpen(p);
      const finance = ctx.can('finance.view');
      const valueMinor = finance ? input.valueMinor : 0;
      const commissionPct = finance ? input.commissionPct : 10;
      const agentSharePct = finance ? input.agentSharePct : 50;
      const [{ max }] = (await tx.select({ max: sql<number>`coalesce(max(${crmDeals.position}), -1)::int` }).from(crmDeals).where(and(eq(crmDeals.pipelineId, p.id), eq(crmDeals.stage, stage.key), isNull(crmDeals.deletedAt)))) as [{ max: number }];
      const agentId = ctx.ownDealsOnly ? ctx.userId : (input.agentId ?? contact.ownerAgentId ?? ctx.userId);
      const [row] = await tx
        .insert(crmDeals)
        .values({
          orgId: ctx.orgId,
          pipelineId: p.id,
          contactId: contact.id,
          listingId: input.listingId ?? null,
          title: input.title,
          stage: stage.key,
          position: max + 1,
          valueMinor,
          commissionPct,
          agentSharePct,
          commissionMinor: dealFinance(valueMinor, commissionPct, agentSharePct).commissionMinor,
          agentId,
          source: input.source ?? contact.source ?? null,
          expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
          closedAt: stage.kind === 'open' ? null : new Date(),
        })
        .returning();
      await this.activities.log(ctx.orgId, { entity: 'deal', entityId: row!.id, type: 'stage_change', payload: { from: null, to: stage.key, created: true }, createdBy: ctx.userId }, tx);
      return row!;
    });
    await this.events.emit('deal.created', { orgId: ctx.orgId, dealId: deal.id, contactId: deal.contactId, actorId: ctx.userId });
    return this.detail(ctx, deal.id);
  }

  async detail(ctx: CrmCtx, id: string) {
    const { d, p, contact, history } = await this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.findVisible(tx, ctx, id);
      const p = (await tx.query.crmPipelines.findFirst({ where: eq(crmPipelines.id, d.pipelineId) })) ?? (await this.pipelines.defaultIn(tx, ctx.orgId));
      const contact = await tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, d.contactId) });
      const history = await tx
        .select()
        .from(crmActivities)
        .where(and(eq(crmActivities.entity, 'deal'), eq(crmActivities.entityId, d.id), eq(crmActivities.type, 'stage_change')))
        .orderBy(asc(crmActivities.createdAt));
      return { d, p: p as PipelineRow, contact, history };
    });
    const listingRow = d.listingId ? await this.read.findRaw(d.listingId) : null;
    const listing = listingRow ? (await this.read.cards([listingRow.id]))[0] ?? null : null;
    const names = await this.names([d.agentId, ...history.map((h) => h.createdBy)]);
    const finance = ctx.can('finance.view');
    const f = dealFinance(d.valueMinor, d.commissionPct, d.agentSharePct);
    const probabilityPct = stageProbabilityPct(p.stages, d.stage);
    return {
      ...this.toCard(d, { contactName: contact?.name ?? null, contactPhone: contact?.phones[0] ?? null, listingTitle: listing?.title ?? null, listingAddress: listing?.address ?? null, agentName: d.agentId ? (names.get(d.agentId) ?? null) : null }, finance),
      pipeline: { id: p.id, name: p.name, stages: p.stages },
      contact: contact ? { id: contact.id, name: contact.name, company: contact.company, phones: contact.phones, emails: contact.emails, type: contact.type } : null,
      listing,
      finance: finance ? { valueMinor: d.valueMinor, commissionPct: d.commissionPct, agentSharePct: d.agentSharePct, ...f, probabilityPct, expectedMinor: Math.round((f.commissionMinor * probabilityPct) / 100) } : null,
      stageHistory: history.map((h) => ({ from: (h.payload.from as string | null) ?? null, to: String(h.payload.to ?? ''), lostReason: (h.payload.lostReason as string | undefined) ?? null, at: h.createdAt.toISOString(), by: h.createdBy ? (names.get(h.createdBy) ?? null) : null })),
    };
  }

  async update(ctx: CrmCtx, id: string, patch: DealPatch) {
    if (!ctx.can('finance.view') && FINANCE_KEYS.some((k) => k in patch)) throw problems.forbidden('ფინანსური ველები ხელმისაწვდომია მხოლოდ finance.view უფლებით');
    if ('agentId' in patch && ctx.ownDealsOnly) throw problems.forbidden('აგენტის შეცვლა — მხოლოდ მენეჯერი ან ასისტენტი');
    await this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.findVisible(tx, ctx, id);
      const set: Partial<typeof crmDeals.$inferInsert> = {};
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.contactId !== undefined && patch.contactId !== d.contactId) {
        const c = await visibleContact(tx, ctx, patch.contactId);
        set.contactId = c.id;
      }
      if (patch.listingId !== undefined && patch.listingId !== d.listingId) set.listingId = patch.listingId ? (await usableListing(tx, ctx, patch.listingId)).id : null;
      if (patch.agentId !== undefined) set.agentId = patch.agentId;
      if (patch.source !== undefined) set.source = patch.source;
      if (patch.expectedCloseAt !== undefined) set.expectedCloseAt = patch.expectedCloseAt ? new Date(patch.expectedCloseAt) : null;
      const valueMinor = patch.valueMinor ?? d.valueMinor;
      const commissionPct = patch.commissionPct ?? d.commissionPct;
      const agentSharePct = patch.agentSharePct ?? d.agentSharePct;
      if (FINANCE_KEYS.some((k) => k in patch)) Object.assign(set, { valueMinor, commissionPct, agentSharePct, commissionMinor: dealFinance(valueMinor, commissionPct, agentSharePct).commissionMinor });
      if (Object.keys(set).length) await tx.update(crmDeals).set(set).where(eq(crmDeals.id, d.id));
    });
    return this.detail(ctx, id);
  }

  /** Drag & drop: stage + position, positions renumbered in source and target columns (one org transaction). */
  async move(ctx: CrmCtx, id: string, body: z.infer<typeof dealMoveSchema>) {
    const result = await this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.findVisible(tx, ctx, id);
      const p = (await tx.query.crmPipelines.findFirst({ where: eq(crmPipelines.id, d.pipelineId) })) as PipelineRow | undefined;
      if (!p) throw problems.notFound('ვორონკა');
      const target = PipelineService.stage(p, body.stage);
      const from = d.stage;
      const changed = from !== target.key;
      const reason = body.lostReason?.trim();
      if (target.kind === 'lost' && changed && !reason) {
        throw new ProblemException(422, 'lost-reason-required', 'მიუთითეთ წაგების მიზეზი', undefined, { errors: [{ path: 'lostReason', message: 'სავალდებულო ველი' }] });
      }
      const column = await tx
        .select({ id: crmDeals.id, position: crmDeals.position })
        .from(crmDeals)
        .where(and(eq(crmDeals.pipelineId, p.id), eq(crmDeals.stage, target.key), isNull(crmDeals.deletedAt), ne(crmDeals.id, d.id)))
        .orderBy(asc(crmDeals.position), desc(crmDeals.updatedAt));
      const index = Math.min(Math.max(0, body.position), column.length);
      const ordered = [...column.slice(0, index).map((c) => c.id), d.id, ...column.slice(index).map((c) => c.id)];
      for (const [i, cid] of ordered.entries()) {
        const current = cid === d.id ? null : column.find((c) => c.id === cid)!.position;
        if (cid !== d.id && current === i) continue;
        if (cid !== d.id) await tx.update(crmDeals).set({ position: i }).where(eq(crmDeals.id, cid));
      }
      const now = new Date();
      const set: Partial<typeof crmDeals.$inferInsert> = { stage: target.key, position: ordered.indexOf(d.id) };
      if (changed) {
        set.stageChangedAt = now;
        const fromKind = p.stages.find((s) => s.key === from)?.kind ?? 'open';
        set.closedAt = target.kind === 'open' ? null : fromKind === target.kind && d.closedAt ? d.closedAt : now;
        set.lostReason = target.kind === 'lost' ? reason! : null;
      } else if (target.kind === 'lost' && reason) set.lostReason = reason;
      await tx.update(crmDeals).set(set).where(eq(crmDeals.id, d.id));
      if (changed) {
        const rest = await tx
          .select({ id: crmDeals.id, position: crmDeals.position })
          .from(crmDeals)
          .where(and(eq(crmDeals.pipelineId, p.id), eq(crmDeals.stage, from), isNull(crmDeals.deletedAt)))
          .orderBy(asc(crmDeals.position), desc(crmDeals.updatedAt));
        for (const [i, r] of rest.entries()) if (r.position !== i) await tx.update(crmDeals).set({ position: i }).where(eq(crmDeals.id, r.id));
        await this.activities.log(ctx.orgId, { entity: 'deal', entityId: d.id, type: 'stage_change', payload: { from, to: target.key, ...(target.kind === 'lost' ? { lostReason: reason } : {}) }, createdBy: ctx.userId }, tx);
      }
      return { d, from, to: target.key, kind: target.kind, changed };
    });
    if (result.changed) {
      await this.events.emit('deal.stage_changed', { orgId: ctx.orgId, dealId: result.d.id, contactId: result.d.contactId, from: result.from, to: result.to, kind: result.kind, actorId: ctx.userId });
    }
    return this.detail(ctx, id);
  }

  async remove(ctx: CrmCtx, id: string) {
    assertCan(ctx, 'records.delete');
    await this.dbs.org(ctx.orgId, async (tx) => {
      const d = await this.findVisible(tx, ctx, id);
      await tx.update(crmDeals).set({ deletedAt: new Date() }).where(eq(crmDeals.id, d.id));
    });
    return { ok: true };
  }
}
