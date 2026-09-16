import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, isNull, listings, livenessChecks, organizations, sql, users } from '@lokacia/db';
import type { CrmLivenessRow, LivenessState } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import { ENV, type Env } from '../../../config/env';
import { SMS, type SmsProvider } from '../../../integrations/sms/sms';
import { SearchService } from '../../search/search.service';
import { ActivityService } from '../shared/activity.service';

const DAY = 86_400_000;
const GRACE_HOURS = 72;

export function livenessState(status: string, daysSince: number | null): LivenessState {
  if (status === 'stale') return 'stale';
  if (daysSince === null || daysSince < 10) return 'ok';
  return daysSince <= 14 ? 'due' : 'overdue';
}

/** C14 liveness automation for org listings: dashboard, bulk "ask the owner" by SMS, confirm on behalf, 6-hourly auto-ask. */
@Injectable()
export class CrmLivenessService implements OnModuleInit {
  private readonly logger = new Logger('CrmLiveness');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly search: SearchService,
    private readonly activities: ActivityService,
    @Inject(SMS) private readonly sms: SmsProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('crm.liveness.auto', () => this.autoAsk());
    this.queue.every('crm.liveness.auto', 6 * 3600_000);
  }

  async dashboard(orgId: string): Promise<CrmLivenessRow[]> {
    const ls = await this.dbs.db
      .select({ l: listings, ownerPhone: users.phone })
      .from(listings)
      .leftJoin(users, eq(users.id, listings.ownerId))
      .where(and(eq(listings.orgId, orgId), isNull(listings.deletedAt), inArray(listings.status, ['active', 'stale'])))
      .orderBy(sql`coalesce(${listings.lastConfirmedAt}, ${listings.publishedAt}, ${listings.createdAt}) asc`);
    const ids = ls.map((r) => r.l.id);
    const checks = ids.length ? await this.dbs.db.select().from(livenessChecks).where(and(inArray(livenessChecks.listingId, ids), isNull(livenessChecks.deletedAt))).orderBy(desc(livenessChecks.sentAt)) : [];
    const last = new Map<string, (typeof checks)[number]>();
    for (const c of checks) if (!last.has(c.listingId)) last.set(c.listingId, c);
    const now = Date.now();
    return ls.map(({ l, ownerPhone }) => {
      const ref = l.lastConfirmedAt ?? l.publishedAt ?? l.createdAt;
      const daysSince = ref ? Math.floor((now - ref.getTime()) / DAY) : null;
      const c = last.get(l.id);
      return {
        id: l.id,
        slug: l.slug,
        title: l.title,
        address: l.address,
        status: l.status,
        lastConfirmedAt: l.lastConfirmedAt?.toISOString() ?? null,
        daysSince,
        state: livenessState(l.status, daysSince),
        lastCheck: c ? { sentAt: c.sentAt.toISOString(), expiresAt: c.expiresAt.toISOString(), result: c.result, channel: c.channel } : null,
        ownerPhone: ownerPhone ?? null,
      };
    });
  }

  /** Creates a liveness check per listing and texts the owner a one-tap confirm link. Skips listings with a pending check. */
  async ask(orgId: string, listingIds: string[], actorId: string | null) {
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    const rows = await this.dbs.db
      .select({ id: listings.id, title: listings.title, ownerPhone: users.phone })
      .from(listings)
      .leftJoin(users, eq(users.id, listings.ownerId))
      .where(and(inArray(listings.id, listingIds), eq(listings.orgId, orgId), isNull(listings.deletedAt)));
    if (!rows.length) throw problems.notFound('განცხადება');
    const pending = await this.dbs.db
      .select({ listingId: livenessChecks.listingId })
      .from(livenessChecks)
      .where(and(inArray(livenessChecks.listingId, rows.map((r) => r.id)), eq(livenessChecks.result, 'pending'), isNull(livenessChecks.deletedAt), sql`${livenessChecks.expiresAt} > now()`));
    const skip = new Set(pending.map((p) => p.listingId));
    const now = new Date();
    let sent = 0;
    const skipped: string[] = [];
    for (const l of rows) {
      const phone = l.ownerPhone ?? org?.phone ?? null;
      if (skip.has(l.id) || !phone) {
        skipped.push(l.id);
        continue;
      }
      const token = randomBytes(24).toString('base64url');
      await this.dbs.db.insert(livenessChecks).values({ listingId: l.id, channel: 'sms', token, sentAt: now, expiresAt: new Date(now.getTime() + GRACE_HOURS * 3600_000), result: 'pending' });
      const link = `${this.env.APP_URL}/confirm/${l.id}?token=${token}`;
      await this.sms.send(phone, `lokacia.ge: „${l.title}“ ისევ თავისუფალია? დაადასტურეთ ერთი დაჭერით: ${link}`);
      await this.activities.log(orgId, { entity: 'listing', entityId: l.id, type: 'sms', payload: { body: 'აქტუალობის შეკითხვა მესაკუთრეს', phone }, createdBy: actorId });
      sent++;
    }
    return { sent, skipped: skipped.length };
  }

  /** Agent confirms after talking to the owner: resets the clock and brings a stale listing back to search. */
  async confirm(orgId: string, listingId: string, actorId: string) {
    const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, listingId), eq(listings.orgId, orgId), isNull(listings.deletedAt)) });
    if (!l) throw problems.notFound('განცხადება');
    if (!['active', 'stale'].includes(l.status)) throw problems.invalidTransition(l.status, 'active');
    const now = new Date();
    await this.dbs.db.update(listings).set({ lastConfirmedAt: now, status: 'active' }).where(eq(listings.id, l.id));
    await this.dbs.db.update(livenessChecks).set({ result: 'confirmed', confirmedAt: now }).where(and(eq(livenessChecks.listingId, l.id), eq(livenessChecks.result, 'pending')));
    await this.search.listingChanged(l.id);
    await this.activities.log(orgId, { entity: 'listing', entityId: l.id, type: 'note', payload: { body: 'ფართის აქტუალობა დადასტურდა აგენტის მიერ' }, createdBy: actorId });
    return { ok: true, lastConfirmedAt: now.toISOString(), status: 'active' as const };
  }

  /** Scheduled: org listings unconfirmed for ≥ 10 days without a pending check. */
  async autoAsk() {
    const due = await this.dbs.db
      .select({ id: listings.id, orgId: listings.orgId })
      .from(listings)
      .where(
        and(
          isNotNull(listings.orgId),
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
          sql`coalesce(${listings.lastConfirmedAt}, ${listings.publishedAt}, ${listings.createdAt}) < now() - interval '10 days'`,
          sql`NOT EXISTS (SELECT 1 FROM liveness_checks c WHERE c.listing_id = ${listings.id} AND c.result = 'pending' AND c.deleted_at IS NULL AND c.expires_at > now())`,
        ),
      )
      .limit(2000);
    const byOrg = new Map<string, string[]>();
    for (const d of due) byOrg.set(d.orgId!, [...(byOrg.get(d.orgId!) ?? []), d.id]);
    let sent = 0;
    for (const [orgId, ids] of byOrg) sent += (await this.ask(orgId, ids, null)).sent;
    if (sent) this.logger.log(`auto-asked ${sent} owners`);
    return sent;
  }
}
