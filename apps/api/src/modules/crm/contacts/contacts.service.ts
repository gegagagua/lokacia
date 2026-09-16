import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  and, conversations, crmActivities, crmContacts, crmDeals, crmLeadSources, crmMatches, crmSequenceRuns, crmTasks, crmViewings, desc, documents, eq, inArray, isNull,
  presentations, sql, users, type SQL, type Tx,
} from '@lokacia/db';
import { decodeCursor, encodeCursor, normalizePhone, type ContactInput, type ContactListQuery, type ContactRow, type DuplicateCluster } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { ENV, type Env } from '../../../config/env';
import { ActivityService } from '../shared/activity.service';
import type { CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';

type ContactDb = typeof crmContacts.$inferSelect;

export function normalizePhones(list: string[]): string[] {
  const out: string[] = [];
  for (const p of list) {
    const n = normalizePhone(p) ?? p.trim();
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Digits of a search term reduced to the local part (drops +995 / leading 0) so any stored format matches. */
function localDigits(q: string) {
  let d = q.replace(/\D/g, '');
  if (d.startsWith('995') && d.length > 9) d = d.slice(3);
  if (d.startsWith('0') && d.length === 10) d = d.slice(1);
  return d;
}

export const newPortalToken = () => randomBytes(12).toString('base64url');

@Injectable()
export class ContactsService {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
    private readonly events: CrmEventsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Visibility (C17): agents only their own contacts. */
  private scope(ctx: CrmCtx): SQL[] {
    const w: SQL[] = [isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId)];
    if (ctx.ownContactsOnly) w.push(eq(crmContacts.ownerAgentId, ctx.userId));
    return w;
  }

  private async agentNames(ids: (string | null)[]) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map<string, string | null>();
    const rows = await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, uniq));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toRow(c: ContactDb, names: Map<string, string | null>): ContactRow {
    const req = c.requirements;
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      company: c.company,
      phones: c.phones,
      emails: c.emails,
      tags: c.tags,
      source: c.source,
      ownerAgentId: c.ownerAgentId,
      ownerAgentName: c.ownerAgentId ? (names.get(c.ownerAgentId) ?? null) : null,
      hasRequirements: !!req && Object.values(req).some((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)),
      lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async list(ctx: CrmCtx, q: ContactListQuery) {
    const offset = decodeCursor<{ o: number }>(q.cursor)?.o ?? 0;
    const where = this.scope(ctx);
    const term = q.q?.trim();
    let order: SQL = sql`${crmContacts.createdAt} desc, ${crmContacts.id} desc`;
    if (term) {
      const digits = localDigits(term);
      const like = `%${term.replace(/[%_\\]/g, '')}%`;
      if (digits.length >= 3 && !/[\p{L}]/u.test(term)) {
        where.push(sql`array_to_string(${crmContacts.phones}, ' ') ~ ${digits.split('').join('\\D*')}`);
      } else {
        where.push(sql`(${crmContacts.name} % ${term} OR ${crmContacts.name} ILIKE ${like} OR ${crmContacts.company} ILIKE ${like} OR array_to_string(${crmContacts.emails}, ' ') ILIKE ${like})`);
        order = sql`similarity(${crmContacts.name}, ${term}) desc, ${crmContacts.createdAt} desc`;
      }
    }
    if (q.type) where.push(eq(crmContacts.type, q.type));
    if (q.tag) where.push(sql`${crmContacts.tags} @> ARRAY[${q.tag}]::text[]`);
    if (q.source) where.push(eq(crmContacts.source, q.source));
    if (q.agentId) where.push(eq(crmContacts.ownerAgentId, q.agentId));
    if (q.hasRequirements === true) where.push(sql`${crmContacts.requirements} IS NOT NULL AND ${crmContacts.requirements}::text <> '{}'`);
    const { rows, total } = await this.dbs.org(ctx.orgId, async (tx) => {
      const rows = await tx.select().from(crmContacts).where(and(...where)).orderBy(order).limit(q.limit + 1).offset(offset);
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(crmContacts).where(and(...where))) as [{ n: number }];
      return { rows, total: n };
    });
    const page = rows.slice(0, q.limit);
    const names = await this.agentNames(page.map((r) => r.ownerAgentId));
    return { items: page.map((r) => this.toRow(r, names)), total, nextCursor: rows.length > q.limit ? encodeCursor({ o: offset + q.limit }) : null };
  }

  async facets(ctx: CrmCtx) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const tags = await tx.execute<{ tag: string; n: number }>(sql`SELECT t AS tag, count(*)::int AS n FROM crm_contacts, unnest(tags) t WHERE deleted_at IS NULL AND merged_into_id IS NULL GROUP BY t ORDER BY n DESC LIMIT 100`);
      const sources = await tx.select({ key: crmLeadSources.key, name: crmLeadSources.name }).from(crmLeadSources).where(isNull(crmLeadSources.deletedAt));
      const used = await tx.execute<{ source: string }>(sql`SELECT DISTINCT source FROM crm_contacts WHERE source IS NOT NULL AND deleted_at IS NULL`);
      const known = new Set(sources.map((s) => s.key));
      return {
        tags: tags.map((t) => ({ tag: t.tag, count: Number(t.n) })),
        sources: [...sources, ...used.filter((u) => !known.has(u.source)).map((u) => ({ key: u.source, name: u.source }))],
      };
    });
  }

  /** Fetches a visible contact or throws 404 (never 403: no existence leaks). */
  async getRaw(ctx: CrmCtx, id: string, tx?: Tx) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('კონტაქტი');
    const run = (t: Tx) => t.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, id), ...this.scope(ctx)) });
    const c = tx ? await run(tx) : await this.dbs.org(ctx.orgId, run);
    if (!c) throw problems.notFound('კონტაქტი');
    return c;
  }

  async detail(ctx: CrmCtx, id: string) {
    const data = await this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.getRaw(ctx, id, tx);
      const deals = await tx
        .select({ id: crmDeals.id, title: crmDeals.title, stage: crmDeals.stage, valueMinor: crmDeals.valueMinor, agentId: crmDeals.agentId, updatedAt: crmDeals.updatedAt })
        .from(crmDeals)
        .where(and(eq(crmDeals.contactId, c.id), isNull(crmDeals.deletedAt)))
        .orderBy(desc(crmDeals.updatedAt));
      const tasks = await tx
        .select({ id: crmTasks.id, title: crmTasks.title, dueAt: crmTasks.dueAt, doneAt: crmTasks.doneAt, priority: crmTasks.priority })
        .from(crmTasks)
        .where(and(eq(crmTasks.contactId, c.id), isNull(crmTasks.deletedAt)))
        .orderBy(sql`${crmTasks.doneAt} IS NOT NULL, ${crmTasks.dueAt} ASC NULLS LAST`)
        .limit(50);
      const viewings = await tx
        .select({ id: crmViewings.id, title: crmViewings.title, startsAt: crmViewings.startsAt, status: crmViewings.status, address: crmViewings.address })
        .from(crmViewings)
        .where(and(eq(crmViewings.contactId, c.id), isNull(crmViewings.deletedAt)))
        .orderBy(desc(crmViewings.startsAt))
        .limit(50);
      const matchStats = await tx
        .select({ status: crmMatches.status, n: sql<number>`count(*)::int` })
        .from(crmMatches)
        .where(and(eq(crmMatches.contactId, c.id), isNull(crmMatches.deletedAt)))
        .groupBy(crmMatches.status);
      return { c, deals, tasks, viewings, matchStats };
    });
    const names = await this.agentNames([data.c.ownerAgentId]);
    return {
      ...this.toRow(data.c, names),
      requirements: data.c.requirements ?? null,
      notes: data.c.notes,
      portalToken: data.c.portalToken,
      deals: data.deals,
      tasks: data.tasks,
      viewings: data.viewings,
      matches: Object.fromEntries(data.matchStats.map((m) => [m.status, Number(m.n)])),
    };
  }

  async create(ctx: CrmCtx, input: ContactInput) {
    const ownerAgentId = input.ownerAgentId ?? (ctx.role === 'agent' ? ctx.userId : null);
    const row = await this.dbs.org(ctx.orgId, async (tx) => {
      const [c] = await tx
        .insert(crmContacts)
        .values({ ...input, orgId: ctx.orgId, phones: normalizePhones(input.phones), emails: [...new Set(input.emails.map((e) => e.toLowerCase()))], ownerAgentId, portalToken: newPortalToken() })
        .returning();
      return c!;
    });
    await this.events.emit('contact.created', { orgId: ctx.orgId, contactId: row.id, actorId: ctx.userId, source: row.source });
    if (row.requirements && Object.keys(row.requirements).length) await this.events.emit('contact.requirements_changed', { orgId: ctx.orgId, contactId: row.id });
    // re-read: lead distribution may have assigned an agent
    const fresh = await this.dbs.org(ctx.orgId, (tx) => tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, row.id) }));
    const names = await this.agentNames([fresh!.ownerAgentId]);
    return { ...this.toRow(fresh!, names), requirements: fresh!.requirements, notes: fresh!.notes, portalToken: fresh!.portalToken };
  }

  async update(ctx: CrmCtx, id: string, patch: Partial<ContactInput>) {
    if (patch.ownerAgentId !== undefined && ctx.ownContactsOnly && patch.ownerAgentId !== ctx.userId) throw problems.forbidden('კონტაქტის სხვა აგენტზე გადაცემა — მხოლოდ მენეჯერი');
    const { before, after } = await this.dbs.org(ctx.orgId, async (tx) => {
      const before = await this.getRaw(ctx, id, tx);
      const set: Partial<typeof crmContacts.$inferInsert> = { ...patch };
      if (patch.phones) set.phones = normalizePhones(patch.phones);
      if (patch.emails) set.emails = [...new Set(patch.emails.map((e) => e.toLowerCase()))];
      const [after] = await tx.update(crmContacts).set(set).where(eq(crmContacts.id, before.id)).returning();
      return { before, after: after! };
    });
    await this.events.emit('contact.updated', { orgId: ctx.orgId, contactId: id, actorId: ctx.userId });
    if (patch.requirements !== undefined && JSON.stringify(before.requirements ?? null) !== JSON.stringify(after.requirements ?? null)) {
      await this.events.emit('contact.requirements_changed', { orgId: ctx.orgId, contactId: id });
    }
    return this.detail(ctx, id);
  }

  async remove(ctx: CrmCtx, id: string) {
    await this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.getRaw(ctx, id, tx);
      await tx.update(crmContacts).set({ deletedAt: new Date() }).where(eq(crmContacts.id, c.id));
    });
    return { ok: true };
  }

  async ensurePortalToken(ctx: CrmCtx, id: string) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.getRaw(ctx, id, tx);
      if (c.portalToken) return c.portalToken;
      const token = newPortalToken();
      await tx.update(crmContacts).set({ portalToken: token }).where(eq(crmContacts.id, c.id));
      return token;
    });
  }

  async rotatePortalToken(ctx: CrmCtx, id: string) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const c = await this.getRaw(ctx, id, tx);
      const token = newPortalToken();
      await tx.update(crmContacts).set({ portalToken: token }).where(eq(crmContacts.id, c.id));
      return token;
    });
  }

  portalUrl(token: string) {
    return `${this.env.CRM_URL}/portal/${token}`;
  }

  /* ---------------- duplicates & merge (C1) ---------------- */

  async duplicates(ctx: CrmCtx): Promise<DuplicateCluster[]> {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const all = await tx.select().from(crmContacts).where(and(...this.scope(ctx)));
      const byId = new Map(all.map((c) => [c.id, c]));
      const parent = new Map<string, string>();
      const find = (x: string): string => {
        const p = parent.get(x) ?? x;
        if (p === x) return x;
        const r = find(p);
        parent.set(x, r);
        return r;
      };
      const reasons = new Map<string, Set<'phone' | 'name'>>();
      const pairSim = new Map<string, number>();
      const union = (a: string, b: string, why: 'phone' | 'name') => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(rb, ra);
        for (const id of [a, b]) {
          const s = reasons.get(id) ?? new Set();
          s.add(why);
          reasons.set(id, s);
        }
      };
      const phoneOwner = new Map<string, string>();
      for (const c of all) {
        for (const p of c.phones) {
          const n = normalizePhone(p);
          if (!n) continue;
          const other = phoneOwner.get(n);
          if (other && other !== c.id) union(other, c.id, 'phone');
          else phoneOwner.set(n, c.id);
        }
      }
      const similar = await tx.execute<{ a: string; b: string; sim: number }>(sql`
        SELECT a.id AS a, b.id AS b, similarity(a.name, b.name) AS sim
        FROM crm_contacts a JOIN crm_contacts b ON a.id < b.id AND a.name % b.name
        WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.merged_into_id IS NULL AND b.merged_into_id IS NULL
          AND similarity(a.name, b.name) >= 0.6`);
      for (const s of similar) {
        if (!byId.has(s.a) || !byId.has(s.b)) continue;
        union(s.a, s.b, 'name');
        pairSim.set(s.a, Math.max(pairSim.get(s.a) ?? 0, Number(s.sim)));
        pairSim.set(s.b, Math.max(pairSim.get(s.b) ?? 0, Number(s.sim)));
      }
      const groups = new Map<string, string[]>();
      for (const id of reasons.keys()) {
        const r = find(id);
        groups.set(r, [...(groups.get(r) ?? []), id]);
      }
      const names = await this.agentNames(all.map((c) => c.ownerAgentId));
      return [...groups.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([key, ids]) => {
          const why = new Set<'phone' | 'name'>();
          ids.forEach((id) => reasons.get(id)?.forEach((r) => why.add(r)));
          const contacts = ids
            .map((id) => byId.get(id)!)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((c) => ({ ...this.toRow(c, names), similarity: pairSim.get(c.id) ?? 1 }));
          return { key, reasons: [...why], contacts };
        });
    });
  }

  async merge(ctx: CrmCtx, targetId: string, sourceIds: string[]) {
    const ids = [...new Set(sourceIds.filter((s) => s !== targetId))];
    if (!ids.length) throw problems.badRequest('გაერთიანებისთვის საჭიროია მინიმუმ ერთი დუბლიკატი');
    const result = await this.dbs.org(ctx.orgId, async (tx) => {
      const target = await this.getRaw(ctx, targetId, tx);
      const sources = await tx.select().from(crmContacts).where(and(inArray(crmContacts.id, ids), ...this.scope(ctx)));
      if (sources.length !== ids.length) throw problems.notFound('კონტაქტი');
      const all = [target, ...sources];
      const set: Partial<typeof crmContacts.$inferInsert> = {
        phones: normalizePhones(all.flatMap((c) => c.phones)),
        emails: [...new Set(all.flatMap((c) => c.emails.map((e) => e.toLowerCase())))],
        tags: [...new Set(all.flatMap((c) => c.tags))],
        company: target.company ?? sources.find((s) => s.company)?.company ?? null,
        source: target.source ?? sources.find((s) => s.source)?.source ?? null,
        ownerAgentId: target.ownerAgentId ?? sources.find((s) => s.ownerAgentId)?.ownerAgentId ?? null,
        requirements: target.requirements && Object.keys(target.requirements).length ? target.requirements : (sources.find((s) => s.requirements)?.requirements ?? null),
        notes: [target.notes, ...sources.map((s) => s.notes)].filter(Boolean).join('\n\n') || null,
        portalToken: target.portalToken ?? sources.find((s) => s.portalToken)?.portalToken ?? null,
        lastContactedAt: all.map((c) => c.lastContactedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      };
      if (!target.portalToken && set.portalToken) {
        // move the token: clear it on the source first (unique index)
        await tx.update(crmContacts).set({ portalToken: null }).where(inArray(crmContacts.id, ids));
      }
      const moved: Record<string, number> = {};
      const count = (k: string, rows: unknown[]) => (moved[k] = rows.length);
      count('deals', await tx.update(crmDeals).set({ contactId: target.id }).where(inArray(crmDeals.contactId, ids)).returning({ id: crmDeals.id }));
      count('tasks', await tx.update(crmTasks).set({ contactId: target.id }).where(inArray(crmTasks.contactId, ids)).returning({ id: crmTasks.id }));
      count('activities', await tx.update(crmActivities).set({ entityId: target.id }).where(and(eq(crmActivities.entity, 'contact'), inArray(crmActivities.entityId, ids))).returning({ id: crmActivities.id }));
      count('viewings', await tx.update(crmViewings).set({ contactId: target.id }).where(inArray(crmViewings.contactId, ids)).returning({ id: crmViewings.id }));
      count('presentations', await tx.update(presentations).set({ contactId: target.id }).where(inArray(presentations.contactId, ids)).returning({ id: presentations.id }));
      count('documents', await tx.update(documents).set({ contactId: target.id }).where(inArray(documents.contactId, ids)).returning({ id: documents.id }));
      count('sequenceRuns', await tx.update(crmSequenceRuns).set({ contactId: target.id }).where(inArray(crmSequenceRuns.contactId, ids)).returning({ id: crmSequenceRuns.id }));
      count('conversations', await tx.update(conversations).set({ contactId: target.id }).where(and(eq(conversations.orgId, ctx.orgId), inArray(conversations.contactId, ids))).returning({ id: conversations.id }));
      // matches: keep one per (contact, listing)
      const targetListings = new Set((await tx.select({ l: crmMatches.listingId }).from(crmMatches).where(eq(crmMatches.contactId, target.id))).map((r) => r.l));
      const srcMatches = await tx.select().from(crmMatches).where(inArray(crmMatches.contactId, ids));
      let movedMatches = 0;
      for (const m of srcMatches) {
        if (targetListings.has(m.listingId)) {
          await tx.delete(crmMatches).where(eq(crmMatches.id, m.id));
        } else {
          await tx.update(crmMatches).set({ contactId: target.id }).where(eq(crmMatches.id, m.id));
          targetListings.add(m.listingId);
          movedMatches++;
        }
      }
      moved.matches = movedMatches;
      await tx.update(crmContacts).set({ mergedIntoId: target.id, deletedAt: new Date() }).where(inArray(crmContacts.id, ids));
      await tx.update(crmContacts).set(set).where(eq(crmContacts.id, target.id));
      await this.activities.log(ctx.orgId, { entity: 'contact', entityId: target.id, type: 'merge', payload: { body: `გაერთიანდა: ${sources.map((s) => s.name).join(', ')}`, sourceIds: ids, moved }, createdBy: ctx.userId }, tx);
      return { targetId: target.id, merged: ids, moved };
    });
    await this.events.emit('contact.merged', { orgId: ctx.orgId, targetId, sourceIds: ids });
    return result;
  }

  /** For the matches tab etc.: count duplicates quickly (phones + names). */
  async duplicatesCount(ctx: CrmCtx) {
    const clusters = await this.duplicates(ctx);
    return { clusters: clusters.length, contacts: clusters.reduce((a, c) => a + c.contacts.length, 0) };
  }
}

