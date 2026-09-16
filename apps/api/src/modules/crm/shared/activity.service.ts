import { Injectable } from '@nestjs/common';
import { and, crmActivities, desc, eq, inArray, isNull, users, type Tx } from '@lokacia/db';
import type { CrmActivity } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';

export type ActivityInput = {
  entity: 'contact' | 'deal' | 'listing';
  entityId: string;
  type: string;
  payload?: Record<string, unknown>;
  createdBy?: string | null;
};

/** Timeline entries for contacts/deals/listings (RLS table `crm_activities`). */
@Injectable()
export class ActivityService {
  constructor(private readonly dbs: DbService) {}

  /** Insert inside an existing org transaction (preferred) or open one. */
  async log(orgId: string, a: ActivityInput, tx?: Tx) {
    const run = (t: Tx) =>
      t
        .insert(crmActivities)
        .values({ orgId, entity: a.entity, entityId: a.entityId, type: a.type, payload: a.payload ?? {}, createdBy: a.createdBy ?? null })
        .returning()
        .then((r) => r[0]!);
    return tx ? run(tx) : this.dbs.org(orgId, run);
  }

  async list(orgId: string, entity: ActivityInput['entity'], entityIds: string[], limit = 200): Promise<CrmActivity[]> {
    if (!entityIds.length) return [];
    const rows = await this.dbs.org(orgId, (tx) =>
      tx
        .select()
        .from(crmActivities)
        .where(and(eq(crmActivities.entity, entity), inArray(crmActivities.entityId, entityIds), isNull(crmActivities.deletedAt)))
        .orderBy(desc(crmActivities.createdAt))
        .limit(limit),
    );
    const authorIds = [...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x))];
    const authors = authorIds.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, authorIds)) : [];
    const names = new Map(authors.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      type: r.type,
      payload: r.payload,
      createdBy: r.createdBy,
      createdByName: r.createdBy ? (names.get(r.createdBy) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
