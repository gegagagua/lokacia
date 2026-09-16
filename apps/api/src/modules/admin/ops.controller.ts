import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, auditLog, desc, eq, feedback, gte, ilike, lte, sql, users } from '@lokacia/db';
import {
  auditQuerySchema, decodeCursor, encodeCursor, escrowResolveSchema, feedbackStatusSchema, financeProductSchema, financeSimulateSchema, type AdminDashboard, type AdminRevenue, type FeedbackDto,
} from '@lokacia/contracts';
import { CurrentUser, Roles } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AppRequest, AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { EscrowService } from '../v2/escrow/escrow.service';
import { FinanceService } from '../v2/finance/finance.service';
import { auditFor } from './moderation.controller';

const uuid = z.string().uuid();
type Num = { n: string | null };

/** Phase 4 dashboard/audit/feedback, Phase 13 revenue view, V3 dispute tools, V10 finance products. */
@ApiTags('admin')
@Roles('moderator')
@Controller('v1/admin')
export class AdminOpsController {
  constructor(
    private readonly dbs: DbService,
    private readonly escrow: EscrowService,
    private readonly finance: FinanceService,
  ) {}

  private async num(q: ReturnType<typeof sql>) {
    const r = await this.dbs.db.execute<Num>(q);
    return Number(r[0]?.n ?? 0);
  }

  /** Monthly recurring revenue: active/grace subscriptions normalised to 30 days (agent plans × seats). */
  private mrr() {
    return this.num(sql`
      SELECT coalesce(sum(round(p.price_minor * (CASE WHEN p.audience = 'agent' THEN s.seats ELSE 1 END) * 30.0 / coalesce(nullif(p.days, 0), 30))), 0) AS n
      FROM subscriptions s JOIN plans p ON p.key = s.plan_key
      WHERE s.status IN ('active', 'past_due', 'grace') AND s.deleted_at IS NULL AND p.kind = 'subscription'`);
  }

  @Get('dashboard')
  async dashboard(): Promise<AdminDashboard> {
    const byStatus = await this.dbs.db.execute<{ status: string; n: string }>(sql`SELECT status, count(*) AS n FROM listings WHERE deleted_at IS NULL GROUP BY status`);
    const signups = await this.dbs.db.execute<{ day: string; n: string }>(sql`
      SELECT to_char(g::date, 'YYYY-MM-DD') AS day, count(u.id) AS n FROM generate_series(current_date - 29, current_date, '1 day') g
      LEFT JOIN users u ON u.created_at::date = g::date AND u.deleted_at IS NULL GROUP BY g ORDER BY g`);
    const events = await this.dbs.db.execute<{ name: string; n: string }>(sql`SELECT name, count(*) AS n FROM analytics_events WHERE created_at > now() - interval '7 days' GROUP BY name ORDER BY n DESC LIMIT 10`);
    return {
      listingsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
      newUsers7d: await this.num(sql`SELECT count(*) AS n FROM users WHERE created_at > now() - interval '7 days' AND deleted_at IS NULL`),
      newUsers30d: await this.num(sql`SELECT count(*) AS n FROM users WHERE created_at > now() - interval '30 days' AND deleted_at IS NULL`),
      usersTotal: await this.num(sql`SELECT count(*) AS n FROM users WHERE deleted_at IS NULL`),
      revenue30dMinor: await this.num(sql`SELECT coalesce(sum(amount_minor), 0) AS n FROM invoices WHERE status = 'paid' AND paid_at > now() - interval '30 days' AND purpose NOT IN ('rent', 'escrow')`),
      mrrMinor: await this.mrr(),
      queues: {
        moderation: await this.num(sql`SELECT count(*) AS n FROM listings WHERE status = 'pending_review' AND deleted_at IS NULL`),
        verifications: await this.num(sql`SELECT count(*) AS n FROM owner_verifications WHERE status = 'pending' AND deleted_at IS NULL`),
        feedback: await this.num(sql`SELECT count(*) AS n FROM feedback WHERE status = 'new' AND deleted_at IS NULL`),
        disputes: await this.num(sql`SELECT count(*) AS n FROM escrow_accounts WHERE status = 'disputed' AND deleted_at IS NULL`),
        failedPayments: await this.num(sql`SELECT count(*) AS n FROM invoices WHERE status = 'failed' AND deleted_at IS NULL`),
      },
      signupsByDay: signups.map((s) => ({ day: s.day, count: Number(s.n) })),
      events7d: events.map((e) => ({ name: e.name, count: Number(e.n) })),
    };
  }

  @Get('revenue')
  @Roles('admin')
  async revenue(): Promise<AdminRevenue> {
    const byMonth = await this.dbs.db.execute<{ month: string; n: string }>(sql`
      WITH m AS (SELECT to_char(date_trunc('month', now()) - (g || ' months')::interval, 'YYYY-MM') AS month FROM generate_series(0, 11) g)
      SELECT m.month, coalesce(sum(i.amount_minor), 0) AS n FROM m
      LEFT JOIN invoices i ON to_char(i.paid_at, 'YYYY-MM') = m.month AND i.status = 'paid' AND i.purpose NOT IN ('rent', 'escrow')
      GROUP BY m.month ORDER BY m.month`);
    const byProduct = await this.dbs.db.execute<{ purpose: string; n: string; c: string }>(sql`
      SELECT purpose, sum(amount_minor) AS n, count(*) AS c FROM invoices WHERE status = 'paid' AND deleted_at IS NULL GROUP BY purpose ORDER BY n DESC`);
    const subs = await this.dbs.db.execute<{ status: string; n: string }>(sql`SELECT status, count(*) AS n FROM subscriptions WHERE deleted_at IS NULL GROUP BY status`);
    const failed = await this.dbs.db.execute<{ id: string; number: string; amount_minor: number; provider: string; attempts: number; created_at: string; payer: string | null }>(sql`
      SELECT DISTINCT ON (i.id) i.id, i.number, i.amount_minor, coalesce(p.provider, '—') AS provider, coalesce(p.attempts, 0) AS attempts, i.created_at, coalesce(o.name, u.name) AS payer
      FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id LEFT JOIN organizations o ON o.id = i.org_id LEFT JOIN users u ON u.id = i.user_id
      WHERE i.status = 'failed' AND i.deleted_at IS NULL ORDER BY i.id, p.created_at DESC LIMIT 100`);
    return {
      mrrMinor: await this.mrr(),
      revenue30dMinor: await this.num(sql`SELECT coalesce(sum(amount_minor), 0) AS n FROM invoices WHERE status = 'paid' AND paid_at > now() - interval '30 days' AND purpose NOT IN ('rent', 'escrow')`),
      byMonth: byMonth.map((r) => ({ month: r.month, amountMinor: Number(r.n) })),
      byProduct: byProduct.map((r) => ({ purpose: r.purpose, amountMinor: Number(r.n), count: Number(r.c) })),
      subscriptionsByStatus: Object.fromEntries(subs.map((s) => [s.status, Number(s.n)])),
      failedPayments: failed.map((f) => ({ id: f.id, invoiceNumber: f.number, amountMinor: f.amount_minor, provider: f.provider, attempts: Number(f.attempts), createdAt: new Date(f.created_at).toISOString(), payer: f.payer })),
      financeCommissionMinor: await this.num(sql`SELECT coalesce(sum(commission_minor), 0) AS n FROM finance_applications WHERE status = 'approved'`),
    };
  }

  @Get('audit')
  async audit(@ZQuery(auditQuerySchema) q: z.infer<typeof auditQuerySchema>) {
    const c = decodeCursor<{ at: string; id: string }>(q.cursor);
    const items = await auditFor(
      this.dbs,
      and(
        q.actorId ? eq(auditLog.actorId, q.actorId) : undefined,
        q.entity ? eq(auditLog.entity, q.entity) : undefined,
        q.entityId ? eq(auditLog.entityId, q.entityId) : undefined,
        q.action ? ilike(auditLog.action, `%${q.action.replace(/[%_]/g, '')}%`) : undefined,
        q.from && !Number.isNaN(Date.parse(q.from)) ? gte(auditLog.createdAt, new Date(q.from)) : undefined,
        q.to && !Number.isNaN(Date.parse(q.to)) ? lte(auditLog.createdAt, new Date(q.to.length === 10 ? `${q.to}T23:59:59.999Z` : q.to)) : undefined,
        c ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (${c.at}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
      q.limit + 1,
    );
    const page = items.slice(0, q.limit);
    const last = page.at(-1);
    return { items: page, nextCursor: items.length > q.limit && last ? encodeCursor({ at: last.createdAt, id: last.id }) : null };
  }

  @Get('feedback')
  async feedbackList(@Query('status') status?: string): Promise<FeedbackDto[]> {
    const st = (['new', 'seen', 'done'] as const).find((s) => s === status);
    const rows = await this.dbs.db
      .select({ f: feedback, userName: users.name })
      .from(feedback)
      .leftJoin(users, eq(users.id, feedback.userId))
      .where(st ? eq(feedback.status, st) : undefined)
      .orderBy(desc(feedback.createdAt))
      .limit(300);
    return rows.map(({ f, userName }) => ({ id: f.id, userId: f.userId, userName, app: f.app, path: f.path, rating: f.rating, message: f.message, status: f.status, createdAt: f.createdAt.toISOString() }));
  }

  @Patch('feedback/:id')
  @ApiZodBody(feedbackStatusSchema)
  async feedbackStatus(@Param('id') id: string, @ZBody(feedbackStatusSchema) body: z.infer<typeof feedbackStatusSchema>) {
    const [row] = await this.dbs.db.update(feedback).set({ status: body.status }).where(eq(feedback.id, uuid.parse(id))).returning();
    if (!row) throw problems.notFound('უკუკავშირი');
    return { id: row.id, status: row.status };
  }

  /* ---------------- escrow disputes ---------------- */

  @Get('escrow')
  escrowList(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.escrow.all(user, status && ['pending', 'funded', 'released', 'refunded', 'disputed'].includes(status) ? status : undefined);
  }

  @Post('escrow/:id/resolve')
  @HttpCode(200)
  @ApiZodBody(escrowResolveSchema)
  async resolve(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(escrowResolveSchema) body: z.infer<typeof escrowResolveSchema>) {
    return this.escrow.dto(await this.escrow.resolve(user, uuid.parse(id), body.outcome, body.note), user);
  }

  @Get('ledger/reconcile')
  reconcile() {
    return this.escrow.reconcile();
  }

  /* ---------------- finance marketplace ---------------- */

  @Get('finance/products')
  products() {
    return this.finance.products(true);
  }

  @Post('finance/products')
  @ApiZodBody(financeProductSchema)
  createProduct(@ZBody(financeProductSchema) body: z.infer<typeof financeProductSchema>) {
    return this.finance.createProduct(body);
  }

  @Patch('finance/products/:id')
  @ApiZodBody(financeProductSchema.partial())
  updateProduct(@Param('id') id: string, @Req() req: AppRequest, @ZBody(financeProductSchema.partial()) body: Partial<z.infer<typeof financeProductSchema>>) {
    const keys = Object.keys((req.body as object) ?? {});
    return this.finance.updateProduct(uuid.parse(id), Object.fromEntries(Object.entries(body).filter(([k]) => keys.includes(k))));
  }

  @Delete('finance/products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.finance.deleteProduct(uuid.parse(id));
  }

  @Get('finance/applications')
  applications() {
    return this.finance.all();
  }

  @Post('finance/applications/:id/simulate')
  @HttpCode(200)
  @ApiZodBody(financeSimulateSchema)
  simulate(@Param('id') id: string, @ZBody(financeSimulateSchema) body: z.infer<typeof financeSimulateSchema>) {
    return this.finance.simulate(uuid.parse(id), body.status, body.approvedAmountMinor);
  }
}
