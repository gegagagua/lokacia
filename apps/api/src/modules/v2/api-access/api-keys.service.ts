import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, apiKeys, apiUsage, desc, eq, inArray, isNull, memberships, organizations, or, plans, sql, subscriptions } from '@lokacia/db';
import type { ApiKeyCreated, ApiKeyDto, ApiScope, ApiUsageDto } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import type { AuthUser } from '../../../common/request';

type KeyRow = typeof apiKeys.$inferSelect;
export const hashApiKey = (raw: string) => createHash('sha256').update(raw).digest('hex');
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;

/** V6: API keys (hash stored, shown once), scopes, per-minute limits, monthly quota, usage metering. */
@Injectable()
export class ApiKeysService {
  constructor(private readonly dbs: DbService) {}

  private async memberOrgIds(userId: string, managerOnly = false) {
    const rows = await this.dbs.db
      .select({ orgId: memberships.orgId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.active, true), isNull(memberships.deletedAt), managerOnly ? eq(memberships.role, 'manager') : sql`true`));
    return rows.map((r) => r.orgId);
  }

  async usedThisMonth(keyId: string) {
    const r = await this.dbs.db.execute<{ s: string | null }>(sql`SELECT sum(count) AS s FROM api_usage WHERE api_key_id = ${keyId} AND day >= ${monthStart()}`);
    return Number(r[0]?.s ?? 0);
  }

  async dto(k: KeyRow): Promise<ApiKeyDto> {
    const org = k.orgId ? await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, k.orgId) }) : null;
    return {
      id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes as ApiScope[], planKey: k.planKey, rateLimitPerMin: k.rateLimitPerMin, monthlyQuota: k.monthlyQuota,
      usedThisMonth: await this.usedThisMonth(k.id), orgId: k.orgId, orgName: org?.name ?? null, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(),
    };
  }

  async list(user: AuthUser) {
    const orgIds = await this.memberOrgIds(user.id, true);
    const rows = await this.dbs.db
      .select()
      .from(apiKeys)
      .where(and(isNull(apiKeys.deletedAt), orgIds.length ? or(eq(apiKeys.userId, user.id), inArray(apiKeys.orgId, orgIds)) : eq(apiKeys.userId, user.id)))
      .orderBy(desc(apiKeys.createdAt));
    return Promise.all(rows.map((r) => this.dto(r)));
  }

  private async owned(user: AuthUser, id: string) {
    const k = await this.dbs.db.query.apiKeys.findFirst({ where: and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)) });
    if (!k) throw problems.notFound('API გასაღები');
    if (k.userId === user.id || user.role === 'admin') return k;
    if (k.orgId && (await this.memberOrgIds(user.id, true)).includes(k.orgId)) return k;
    throw problems.notFound('API გასაღები');
  }

  /** Plan limits from the owner's active API subscription; trial limits otherwise. */
  private async limitsFor(userId: string, orgId: string | null) {
    const sub = await this.dbs.db.query.subscriptions.findFirst({
      where: and(orgId ? eq(subscriptions.orgId, orgId) : eq(subscriptions.userId, userId), inArray(subscriptions.planKey, ['api_basic', 'api_pro']), inArray(subscriptions.status, ['active', 'past_due', 'grace'])),
    });
    if (!sub) return { planKey: 'api_trial', rateLimitPerMin: 10, monthlyQuota: 500 };
    const plan = await this.dbs.db.query.plans.findFirst({ where: eq(plans.key, sub.planKey) });
    return { planKey: sub.planKey, rateLimitPerMin: plan?.limits.perMin ?? 60, monthlyQuota: plan?.limits.monthlyQuota ?? 10000 };
  }

  async create(user: AuthUser, input: { name: string; scopes: ApiScope[]; orgId?: string | null }): Promise<ApiKeyCreated> {
    if (input.orgId && user.role !== 'admin' && !(await this.memberOrgIds(user.id, true)).includes(input.orgId)) throw problems.forbidden('ორგანიზაციის გასაღებს ქმნის მენეჯერი');
    const count = await this.dbs.db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM api_keys WHERE user_id = ${user.id} AND revoked_at IS NULL AND deleted_at IS NULL`);
    if (Number(count[0]?.n ?? 0) >= 10) throw problems.conflict('აქტიური გასაღებების ლიმიტი — 10');
    const raw = `lk_live_${randomBytes(24).toString('base64url')}`;
    const limits = await this.limitsFor(user.id, input.orgId ?? null);
    const [row] = await this.dbs.db
      .insert(apiKeys)
      .values({ userId: user.id, orgId: input.orgId ?? null, name: input.name, prefix: raw.slice(0, 12), keyHash: hashApiKey(raw), scopes: [...new Set(input.scopes)], ...limits })
      .returning();
    return { ...(await this.dto(row!)), key: raw };
  }

  async revoke(user: AuthUser, id: string) {
    const k = await this.owned(user, id);
    await this.dbs.db.update(apiKeys).set({ revokedAt: k.revokedAt ?? new Date() }).where(eq(apiKeys.id, k.id));
    return { ok: true };
  }

  async usage(user: AuthUser, id: string): Promise<ApiUsageDto> {
    const k = await this.owned(user, id);
    return this.usageFor(k);
  }

  async usageFor(k: KeyRow): Promise<ApiUsageDto> {
    const days = await this.dbs.db.execute<{ day: string; n: string }>(sql`
      SELECT to_char(g::date, 'YYYY-MM-DD') AS day, coalesce(sum(u.count), 0) AS n FROM generate_series(current_date - 29, current_date, '1 day') g
      LEFT JOIN api_usage u ON u.day = g::date AND u.api_key_id = ${k.id} GROUP BY g ORDER BY g`);
    const eps = await this.dbs.db.execute<{ endpoint: string; n: string }>(sql`SELECT endpoint, sum(count) AS n FROM api_usage WHERE api_key_id = ${k.id} AND day >= current_date - 29 GROUP BY endpoint ORDER BY n DESC`);
    return { days: days.map((d) => ({ day: d.day, count: Number(d.n) })), byEndpoint: eps.map((e) => ({ endpoint: e.endpoint, count: Number(e.n) })), usedThisMonth: await this.usedThisMonth(k.id), monthlyQuota: k.monthlyQuota };
  }

  async findByRaw(raw: string) {
    return this.dbs.db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, hashApiKey(raw)), isNull(apiKeys.revokedAt), isNull(apiKeys.deletedAt)) });
  }

  async meter(keyId: string, endpoint: string) {
    const day = new Date().toISOString().slice(0, 10);
    await this.dbs.db
      .insert(apiUsage)
      .values({ apiKeyId: keyId, day, endpoint, count: 1 })
      .onConflictDoUpdate({ target: [apiUsage.apiKeyId, apiUsage.day, apiUsage.endpoint], set: { count: sql`${apiUsage.count} + 1`, updatedAt: new Date() } });
    await this.dbs.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId));
  }
}
