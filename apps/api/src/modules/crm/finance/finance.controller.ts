import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, crmContacts, crmDeals, crmLeadSources, crmPipelines, eq, gte, isNull } from '@lokacia/db';
import { dealFinance, leadSourceSchema, leadSourceUpdateSchema, stageProbabilityPct, type SourceRoi } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import type { AppRequest } from '../../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';

const calcSchema = z.object({ valueMinor: z.number().int().min(0), commissionPct: z.number().min(0).max(100), agentSharePct: z.number().min(0).max(100) });
const roiQuery = z.object({ months: z.coerce.number().int().min(1).max(36).default(6) });

export function monthsAgo(months: number, now = new Date()) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/** C18 commission calculator & finance summary, C19 lead sources with monthly cost and ROI. */
@ApiTags('crm-finance')
@Controller('v1/crm')
@Crm()
export class FinanceController {
  constructor(private readonly dbs: DbService) {}

  @Post('finance/calculate')
  @HttpCode(200)
  @Crm('finance.view')
  @ApiZodBody(calcSchema)
  calculate(@ZBody(calcSchema) b: z.infer<typeof calcSchema>) {
    return { ...b, ...dealFinance(b.valueMinor, b.commissionPct, b.agentSharePct) };
  }

  /** Pipeline finance: expected commission weighted by stage probability, per agent payouts of open deals. */
  @Get('finance/summary')
  @Crm('finance.view')
  async summary(@Ctx() ctx: CrmCtx) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const p = await tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) });
      const where = [isNull(crmDeals.deletedAt)];
      if (ctx.ownDealsOnly) where.push(eq(crmDeals.agentId, ctx.userId));
      const deals = await tx.select().from(crmDeals).where(and(...where));
      const stages = p?.stages ?? [];
      let expected = 0;
      let pipeline = 0;
      let agentShare = 0;
      for (const d of deals) {
        const kind = stages.find((s) => s.key === d.stage)?.kind;
        if (kind !== 'open') continue;
        const f = dealFinance(d.valueMinor, d.commissionPct, d.agentSharePct);
        pipeline += f.commissionMinor;
        agentShare += f.agentMinor;
        expected += Math.round((f.commissionMinor * stageProbabilityPct(stages, d.stage)) / 100);
      }
      return { openCommissionMinor: pipeline, expectedCommissionMinor: expected, openAgentShareMinor: agentShare, openAgencyShareMinor: pipeline - agentShare };
    });
  }

  @Get('sources')
  async sources(@Ctx() ctx: CrmCtx) {
    const rows = await this.dbs.org(ctx.orgId, (tx) => tx.select().from(crmLeadSources).where(isNull(crmLeadSources.deletedAt)).orderBy(crmLeadSources.name));
    const finance = ctx.can('finance.view');
    return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, monthlyCostMinor: finance ? r.monthlyCostMinor : null }));
  }

  @Post('sources')
  @Crm('sources.manage')
  @ApiZodBody(leadSourceSchema)
  async createSource(@Ctx() ctx: CrmCtx, @ZBody(leadSourceSchema) body: z.infer<typeof leadSourceSchema>) {
    return this.dbs.org(ctx.orgId, async (tx) => {
      const dup = await tx.query.crmLeadSources.findFirst({ where: eq(crmLeadSources.key, body.key) });
      if (dup && !dup.deletedAt) throw problems.conflict('ასეთი გასაღებით წყარო უკვე არსებობს');
      if (dup) {
        const [row] = await tx.update(crmLeadSources).set({ ...body, deletedAt: null }).where(eq(crmLeadSources.id, dup.id)).returning();
        return row;
      }
      const [row] = await tx.insert(crmLeadSources).values({ orgId: ctx.orgId, ...body }).returning();
      return row;
    });
  }

  @Patch('sources/:id')
  @Crm('sources.manage')
  @ApiZodBody(leadSourceUpdateSchema)
  async updateSource(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(leadSourceUpdateSchema) body: z.infer<typeof leadSourceUpdateSchema>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k)));
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('წყარო');
    const [row] = await this.dbs.org(ctx.orgId, (tx) => tx.update(crmLeadSources).set(patch).where(and(eq(crmLeadSources.id, id), isNull(crmLeadSources.deletedAt))).returning());
    if (!row) throw problems.notFound('წყარო');
    return row;
  }

  @Delete('sources/:id')
  @HttpCode(200)
  @Crm('sources.manage')
  async removeSource(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('წყარო');
    const [row] = await this.dbs.org(ctx.orgId, (tx) => tx.update(crmLeadSources).set({ deletedAt: new Date() }).where(eq(crmLeadSources.id, id)).returning());
    if (!row) throw problems.notFound('წყარო');
    return { ok: true };
  }

  /** ROI per lead source over the last N months: won commission vs monthly cost × N. */
  @Get('sources/roi')
  @Crm('finance.view')
  async roi(@Ctx() ctx: CrmCtx, @ZQuery(roiQuery) q: z.infer<typeof roiQuery>): Promise<{ months: number; from: string; items: SourceRoi[] }> {
    const from = monthsAgo(q.months);
    return this.dbs.org(ctx.orgId, async (tx) => {
      const p = await tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) });
      const wonKeys = new Set((p?.stages ?? []).filter((s) => s.kind === 'won').map((s) => s.key));
      const sources = await tx.select().from(crmLeadSources).where(isNull(crmLeadSources.deletedAt));
      const cWhere = [isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId), gte(crmContacts.createdAt, from)];
      if (ctx.ownContactsOnly) cWhere.push(eq(crmContacts.ownerAgentId, ctx.userId));
      const contacts = await tx.select({ source: crmContacts.source }).from(crmContacts).where(and(...cWhere));
      const dWhere = [isNull(crmDeals.deletedAt)];
      if (ctx.ownDealsOnly) dWhere.push(eq(crmDeals.agentId, ctx.userId));
      const deals = await tx.select().from(crmDeals).where(and(...dWhere));
      const keys = new Set([...sources.map((s) => s.key), ...contacts.map((c) => c.source).filter((x): x is string => !!x)]);
      const items: SourceRoi[] = [...keys].map((key) => {
        const src = sources.find((s) => s.key === key);
        const leads = contacts.filter((c) => c.source === key).length;
        const created = deals.filter((d) => d.source === key && d.createdAt >= from).length;
        const won = deals.filter((d) => d.source === key && wonKeys.has(d.stage) && d.closedAt && d.closedAt >= from);
        const wonCommission = won.reduce((a, d) => a + d.commissionMinor, 0);
        const cost = src ? src.monthlyCostMinor * q.months : null;
        return {
          key,
          name: src?.name ?? key,
          monthlyCostMinor: src?.monthlyCostMinor ?? null,
          leads,
          deals: created,
          won: won.length,
          wonCommissionMinor: wonCommission,
          costMinor: cost,
          roiPct: cost ? Math.round(((wonCommission - cost) / cost) * 1000) / 10 : null,
          costPerLeadMinor: cost !== null && leads > 0 ? Math.round(cost / leads) : null,
          conversionPct: leads > 0 ? Math.round((won.length / leads) * 1000) / 10 : 0,
        };
      });
      items.sort((a, b) => (b.wonCommissionMinor ?? 0) - (a.wonCommissionMinor ?? 0) || b.leads - a.leads);
      return { months: q.months, from: from.toISOString(), items };
    });
  }
}
