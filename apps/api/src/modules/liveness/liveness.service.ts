import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNull, listingMedia, listings, livenessChecks, lt, sql, users } from '@lokacia/db';
import type { LivenessCheckInfo } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { ProblemException, problems } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import { SettingsService } from '../../common/settings.service';
import { NotificationsService, type Channel } from '../notifications/notifications.service';
import { registerTemplates } from '../notifications/templates';
import { SearchService } from '../search/search.service';

registerTemplates({
  liveness_request: { title: () => 'ფართი ისევ თავისუფალია?', body: (v) => `„${v.title}“ — დაადასტურეთ ერთი დაჭერით: „კი, ისევ თავისუფალია“ ან „გაქირავდა“. ${v.link ?? ''}`.trim() },
  liveness_hidden: { title: () => 'განცხადება დამალდა', body: (v) => `„${v.title}“ ${v.hours} საათში არ დადასტურდა და ძებნიდან დამალდა. დაადასტურეთ, რომ ისევ გამოჩნდეს.` },
});

const HOUR = 3600_000;

/**
 * P4 liveness control. Every `liveness_interval_days` an active listing gets a one-tap confirm link
 * (SMS/Telegram/email + in-app). No answer within `liveness_grace_hours` → status `stale` (hidden from search).
 */
@Injectable()
export class LivenessService implements OnModuleInit {
  private readonly logger = new Logger('Liveness');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly settings: SettingsService,
    private readonly notify: NotificationsService,
    private readonly search: SearchService,
  ) {}

  onModuleInit() {
    this.queue.register('liveness.send', () => this.sendDue());
    this.queue.register('liveness.expire', () => this.expireDue());
    this.queue.every('liveness.send', HOUR);
    this.queue.every('liveness.expire', HOUR);
  }

  /** Creates checks for active listings whose last confirmation is older than the interval and notifies the contact person. */
  async sendDue(now = new Date(), opts: { listingIds?: string[] } = {}) {
    const intervalDays = (await this.settings.number('liveness_interval_days')) || 12;
    const graceHours = (await this.settings.number('liveness_grace_hours')) || 72;
    const cutoff = new Date(now.getTime() - intervalDays * 24 * HOUR);
    const due = await this.dbs.db
      .select({ id: listings.id, title: listings.title, ownerId: listings.ownerId, agentId: listings.agentId })
      .from(listings)
      .where(
        and(
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
          sql`coalesce(${listings.lastConfirmedAt}, ${listings.publishedAt}, ${listings.createdAt}) < ${cutoff.toISOString()}::timestamptz`,
          sql`NOT EXISTS (SELECT 1 FROM liveness_checks c WHERE c.listing_id = ${listings.id} AND c.result = 'pending' AND c.deleted_at IS NULL)`,
          opts.listingIds ? inArray(listings.id, opts.listingIds) : undefined,
        ),
      )
      .orderBy(asc(listings.lastConfirmedAt))
      .limit(2000);
    let sent = 0;
    for (const l of due) {
      const token = randomBytes(24).toString('base64url');
      const userId = l.agentId ?? l.ownerId;
      const user = await this.dbs.db.query.users.findFirst({ where: eq(users.id, userId) });
      const link = `/confirm/${l.id}?token=${token}`;
      const channels = this.channelsFor(user);
      await this.dbs.db.insert(livenessChecks).values({ listingId: l.id, channel: channels.filter((c) => c !== 'in_app').join(',') || 'in_app', token, sentAt: now, expiresAt: new Date(now.getTime() + graceHours * HOUR), result: 'pending' });
      await this.notify.notify({ userId, template: 'liveness_request', vars: { title: l.title, link: `${link}` }, link, channels, category: 'liveness' });
      sent++;
    }
    if (sent) this.logger.log(`sent ${sent} liveness requests`);
    return sent;
  }

  /** Pending checks past their grace period → listing `stale`, owner notified. */
  async expireDue(now = new Date(), opts: { listingIds?: string[] } = {}) {
    const graceHours = (await this.settings.number('liveness_grace_hours')) || 72;
    const expired = await this.dbs.db
      .select({ id: livenessChecks.id, listingId: livenessChecks.listingId })
      .from(livenessChecks)
      .where(and(eq(livenessChecks.result, 'pending'), lt(livenessChecks.expiresAt, now), isNull(livenessChecks.deletedAt), opts.listingIds ? inArray(livenessChecks.listingId, opts.listingIds) : undefined));
    let hidden = 0;
    for (const c of expired) {
      await this.dbs.db.update(livenessChecks).set({ result: 'expired' }).where(eq(livenessChecks.id, c.id));
      const [l] = await this.dbs.db
        .update(listings)
        .set({ status: 'stale' })
        .where(and(eq(listings.id, c.listingId), eq(listings.status, 'active')))
        .returning({ id: listings.id, title: listings.title, ownerId: listings.ownerId, agentId: listings.agentId });
      if (!l) continue;
      hidden++;
      await this.search.listingChanged(l.id);
      await this.notify.notify({ userId: l.agentId ?? l.ownerId, template: 'liveness_hidden', vars: { title: l.title, hours: graceHours }, link: '/account/listings', category: 'liveness' });
    }
    if (hidden) this.logger.log(`hid ${hidden} unconfirmed listings`);
    return hidden;
  }

  async checkInfo(listingId: string, token: string): Promise<LivenessCheckInfo> {
    if (!/^[0-9a-f-]{36}$/i.test(listingId) || token.length < 10) throw problems.notFound('ბმული');
    const check = await this.dbs.db.query.livenessChecks.findFirst({ where: and(eq(livenessChecks.listingId, listingId), eq(livenessChecks.token, token)) });
    if (!check) throw new ProblemException(410, 'link-expired', 'ბმული არასწორია ან ვადა გაუვიდა');
    const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, listingId), isNull(listings.deletedAt)) });
    if (!l) throw problems.notFound('განცხადება');
    const cover = await this.dbs.db.query.listingMedia.findFirst({ where: and(eq(listingMedia.listingId, l.id), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt)), orderBy: asc(listingMedia.sort) });
    return {
      listing: { id: l.id, slug: l.slug, title: l.title, address: l.address, status: l.status, cover: cover ? (cover.variants?.md ?? cover.url) : null, lastConfirmedAt: l.lastConfirmedAt?.toISOString() ?? null },
      check: { sentAt: check.sentAt.toISOString(), expiresAt: check.expiresAt.toISOString(), confirmedAt: check.confirmedAt?.toISOString() ?? null, result: check.result },
    };
  }

  private channelsFor(user: typeof users.$inferSelect | undefined): Channel[] {
    const prefs = user?.notificationPrefs?.liveness as Channel[] | undefined;
    if (prefs?.length) return [...new Set<Channel>([...prefs, 'in_app'])];
    const out: Channel[] = ['in_app', 'sms'];
    if (user?.telegramChatId) out.push('telegram');
    if (user?.email) out.push('email');
    return out;
  }
}
