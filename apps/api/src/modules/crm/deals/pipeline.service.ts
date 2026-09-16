import { Injectable } from '@nestjs/common';
import { and, crmDeals, crmPipelines, eq, inArray, isNull, sql, type Tx } from '@lokacia/db';
import type { PipelineUpdate } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems, ProblemException } from '../../../common/problem';

export type PipelineRow = typeof crmPipelines.$inferSelect;

export const FALLBACK_STAGES = [
  { key: 'lead', name: 'ლიდი', kind: 'open' as const },
  { key: 'viewing', name: 'ჩვენება', kind: 'open' as const },
  { key: 'offer', name: 'შეთავაზება', kind: 'open' as const },
  { key: 'contract', name: 'ხელშეკრულება', kind: 'open' as const },
  { key: 'won', name: 'მოგებული', kind: 'won' as const },
  { key: 'lost', name: 'წაგებული', kind: 'lost' as const },
];

/** Configurable pipeline per org (C3). One default pipeline; created lazily if an org has none. */
@Injectable()
export class PipelineService {
  constructor(private readonly dbs: DbService) {}

  async defaultIn(tx: Tx, orgId: string): Promise<PipelineRow> {
    const p = await tx.query.crmPipelines.findFirst({ where: and(eq(crmPipelines.isDefault, true), isNull(crmPipelines.deletedAt)) });
    if (p) return p;
    const any = await tx.query.crmPipelines.findFirst({ where: isNull(crmPipelines.deletedAt) });
    if (any) return any;
    const [created] = await tx.insert(crmPipelines).values({ orgId, name: 'ძირითადი', stages: FALLBACK_STAGES, isDefault: true }).returning();
    return created!;
  }

  getDefault(orgId: string) {
    return this.dbs.org(orgId, (tx) => this.defaultIn(tx, orgId));
  }

  async withCounts(orgId: string) {
    return this.dbs.org(orgId, async (tx) => {
      const p = await this.defaultIn(tx, orgId);
      const counts = await tx
        .select({ stage: crmDeals.stage, n: sql<number>`count(*)::int` })
        .from(crmDeals)
        .where(and(eq(crmDeals.pipelineId, p.id), isNull(crmDeals.deletedAt)))
        .groupBy(crmDeals.stage);
      const byStage = new Map(counts.map((c) => [c.stage, c.n]));
      return { id: p.id, name: p.name, stages: p.stages.map((s) => ({ ...s, dealsCount: byStage.get(s.key) ?? 0 })) };
    });
  }

  async update(orgId: string, body: PipelineUpdate) {
    await this.dbs.org(orgId, async (tx) => {
      const p = await this.defaultIn(tx, orgId);
      const newKeys = new Set(body.stages.map((s) => s.key));
      const removed = p.stages.filter((s) => !newKeys.has(s.key)).map((s) => s.key);
      if (removed.length) {
        const counts = await tx
          .select({ stage: crmDeals.stage, n: sql<number>`count(*)::int` })
          .from(crmDeals)
          .where(and(eq(crmDeals.pipelineId, p.id), isNull(crmDeals.deletedAt), inArray(crmDeals.stage, removed)))
          .groupBy(crmDeals.stage);
        for (const c of counts) {
          if (!c.n) continue;
          const target = body.moveTo[c.stage];
          if (!target || !newKeys.has(target)) {
            throw new ProblemException(422, 'stage-has-deals', 'ეტაპზე გარიგებები არის', `ეტაპი „${c.stage}“ შეიცავს ${c.n} გარიგებას — მიუთითეთ, სად გადაიტანოთ`, {
              errors: [{ path: `moveTo.${c.stage}`, message: 'აირჩიეთ ეტაპი, სადაც გადავა გარიგებები' }],
            });
          }
          const kind = body.stages.find((s) => s.key === target)!.kind;
          await tx
            .update(crmDeals)
            .set({ stage: target, stageChangedAt: new Date(), closedAt: kind === 'open' ? null : sql`coalesce(${crmDeals.closedAt}, now())` })
            .where(and(eq(crmDeals.pipelineId, p.id), eq(crmDeals.stage, c.stage)));
        }
      }
      await tx.update(crmPipelines).set({ stages: body.stages, ...(body.name ? { name: body.name } : {}) }).where(eq(crmPipelines.id, p.id));
    });
    return this.withCounts(orgId);
  }

  static stage(p: PipelineRow, key: string) {
    const s = p.stages.find((x) => x.key === key);
    if (!s) throw new ProblemException(422, 'unknown-stage', 'ეტაპი არ მოიძებნა', key);
    return s;
  }

  static firstOpen(p: PipelineRow) {
    const s = p.stages.find((x) => x.kind === 'open');
    if (!s) throw problems.badRequest('pipeline has no open stage');
    return s;
  }
}
