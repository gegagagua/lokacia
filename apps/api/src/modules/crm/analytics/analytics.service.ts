import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { and, crmContacts, crmDeals, crmPipelines, crmTasks, crmViewings, eq, gte, inArray, isNull, lt, lte, sql, users } from '@lokacia/db';
import type { KpiReport, kpiQuerySchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import type { CrmCtx } from '../shared/crm-access';

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** C20 KPI dashboard numbers. Agents see only their own numbers; finance stripped without `finance.view`. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly dbs: DbService) {}

  async kpi(ctx: CrmCtx, q: z.infer<typeof kpiQuerySchema>): Promise<KpiReport> {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * DAY);
    const own = ctx.ownDealsOnly;
    const agentId = own ? ctx.userId : (q.agentId ?? null);
    const finance = ctx.can('finance.view');
    const money = (n: number) => (finance ? n : null);

    const data = await this.dbs.org(ctx.orgId, async (tx) => {
      const p = await tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) });
      const dWhere = [isNull(crmDeals.deletedAt)];
      if (p) dWhere.push(eq(crmDeals.pipelineId, p.id));
      if (agentId) dWhere.push(eq(crmDeals.agentId, agentId));
      const deals = await tx.select().from(crmDeals).where(and(...dWhere));
      const cWhere = [isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId), gte(crmContacts.createdAt, from), lte(crmContacts.createdAt, to)];
      if (agentId) cWhere.push(eq(crmContacts.ownerAgentId, agentId));
      const [{ n: newContacts }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(crmContacts).where(and(...cWhere))) as [{ n: number }];
      const vWhere = [isNull(crmViewings.deletedAt), gte(crmViewings.startsAt, from), lte(crmViewings.startsAt, to), sql`${crmViewings.status} <> 'cancelled'`];
      if (agentId) vWhere.push(eq(crmViewings.agentId, agentId));
      const [{ n: viewings }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(crmViewings).where(and(...vWhere))) as [{ n: number }];
      const tWhere = [isNull(crmTasks.deletedAt), isNull(crmTasks.doneAt), lt(crmTasks.dueAt, new Date())];
      if (agentId) tWhere.push(eq(crmTasks.assigneeId, agentId));
      const [{ n: tasksOverdue }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(crmTasks).where(and(...tWhere))) as [{ n: number }];
      return { stages: p?.stages ?? [], deals, newContacts, viewings, tasksOverdue };
    });

    const kindOf = (key: string) => data.stages.find((s) => s.key === key)?.kind ?? 'open';
    const inPeriod = (d: Date | null) => !!d && d >= from && d <= to;
    const won = data.deals.filter((d) => kindOf(d.stage) === 'won' && inPeriod(d.closedAt));
    const lost = data.deals.filter((d) => kindOf(d.stage) === 'lost' && inPeriod(d.closedAt));
    const open = data.deals.filter((d) => kindOf(d.stage) === 'open');
    const created = data.deals.filter((d) => inPeriod(d.createdAt));
    const createdWon = created.filter((d) => kindOf(d.stage) === 'won');
    const sum = (arr: typeof data.deals, f: (d: (typeof data.deals)[number]) => number) => arr.reduce((a, d) => a + f(d), 0);

    const byStage = data.stages.map((s) => {
      const list = s.kind === 'open' ? open.filter((d) => d.stage === s.key) : (s.kind === 'won' ? won : lost).filter((d) => d.stage === s.key);
      return { key: s.key, name: s.name, kind: s.kind, count: list.length, valueMinor: money(sum(list, (d) => d.valueMinor)) };
    });

    const agentIds = [...new Set(data.deals.map((d) => d.agentId).filter((x): x is string => !!x))];
    const names = agentIds.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, agentIds)) : [];
    const ranking = agentIds
      .map((id) => {
        const w = won.filter((d) => d.agentId === id);
        const l = lost.filter((d) => d.agentId === id);
        return {
          agentId: id,
          name: names.find((n) => n.id === id)?.name ?? null,
          wonCount: w.length,
          lostCount: l.length,
          wonCommissionMinor: money(sum(w, (d) => d.commissionMinor)),
          conversionPct: w.length + l.length ? round1((w.length / (w.length + l.length)) * 100) : 0,
          openDeals: open.filter((d) => d.agentId === id).length,
          _c: sum(w, (d) => d.commissionMinor),
        };
      })
      .sort((a, b) => (finance ? b._c - a._c : 0) || b.wonCount - a.wonCount || b.conversionPct - a.conversionPct)
      .map(({ _c, ...r }) => r);

    const monthly: KpiReport['monthly'] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - i + 1, 1));
      const m = data.deals.filter((d) => kindOf(d.stage) === 'won' && d.closedAt && d.closedAt >= start && d.closedAt < end);
      monthly.push({ month: start.toISOString().slice(0, 7), wonCount: m.length, wonValueMinor: money(sum(m, (d) => d.valueMinor)) });
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      byStage,
      totals: {
        openDeals: open.length,
        wonCount: won.length,
        lostCount: lost.length,
        winRatePct: won.length + lost.length ? round1((won.length / (won.length + lost.length)) * 100) : 0,
        leadToWonPct: created.length ? round1((createdWon.length / created.length) * 100) : 0,
        avgCycleDays: won.length ? round1(sum(won, (d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / DAY) / won.length) : null,
        wonValueMinor: money(sum(won, (d) => d.valueMinor)),
        wonCommissionMinor: money(sum(won, (d) => d.commissionMinor)),
        pipelineValueMinor: money(sum(open, (d) => d.valueMinor)),
        newContacts: data.newContacts,
        newDeals: created.length,
        viewings: data.viewings,
        tasksOverdue: data.tasksOverdue,
      },
      ranking,
      monthly,
      financeHidden: !finance,
      scope: own ? 'own' : 'org',
    };
  }
}
