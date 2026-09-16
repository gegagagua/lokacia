import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, auditLog, desc, eq, gte, ilike, inArray, lt, or, sql, users } from '@lokacia/db';
import { crmAuditQuerySchema, decodeCursor, encodeCursor, type CrmAuditRow } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';

/** C24 audit viewer: the org's slice of audit_log (written by AuditInterceptor for every mutation). */
@ApiTags('crm')
@Controller('v1/crm/audit')
@Crm('audit.view')
export class CrmAuditController {
  constructor(private readonly dbs: DbService) {}

  @Get()
  async list(@Ctx() ctx: CrmCtx, @ZQuery(crmAuditQuerySchema) q: z.infer<typeof crmAuditQuerySchema>) {
    const cur = decodeCursor<{ at: string; id: string }>(q.cursor);
    const where = [
      eq(auditLog.orgId, ctx.orgId),
      q.actorId ? eq(auditLog.actorId, q.actorId) : undefined,
      q.entity ? eq(auditLog.entity, q.entity) : undefined,
      q.action ? ilike(auditLog.action, `%${q.action}%`) : undefined,
      q.from ? gte(auditLog.createdAt, new Date(`${q.from}T00:00:00Z`)) : undefined,
      q.to ? lt(auditLog.createdAt, new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 86_400_000)) : undefined,
      cur ? or(lt(auditLog.createdAt, new Date(cur.at)), and(eq(auditLog.createdAt, new Date(cur.at)), sql`${auditLog.id} < ${cur.id}`)) : undefined,
    ];
    const rows = await this.dbs.db
      .select()
      .from(auditLog)
      .where(and(...where))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const ids = [...new Set(page.map((r) => r.actorId).filter((x): x is string => !!x))];
    const names = ids.length ? await this.dbs.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, ids)) : [];
    const byId = new Map(names.map((n) => [n.id, n.name ?? n.phone]));
    const items: CrmAuditRow[] = page.map((r) => ({ id: r.id, actorId: r.actorId, actorName: r.actorId ? (byId.get(r.actorId) ?? null) : null, action: r.action, entity: r.entity, entityId: r.entityId, diff: r.diff, ip: r.ip, createdAt: r.createdAt.toISOString() }));
    const last = page[page.length - 1];
    const entities = await this.dbs.db.selectDistinct({ entity: auditLog.entity }).from(auditLog).where(eq(auditLog.orgId, ctx.orgId)).limit(50);
    return { items, nextCursor: rows.length > q.limit && last ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id }) : null, entities: entities.map((e) => e.entity) };
  }
}
