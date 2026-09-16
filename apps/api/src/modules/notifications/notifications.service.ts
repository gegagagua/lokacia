import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, isNull, notifications, users } from '@lokacia/db';
import { DbService } from '../../common/db.service';
import { QueueService } from '../../common/queue.service';
import { SMS, type SmsProvider } from '../../integrations/sms/sms';
import { CHANNELS, type MessageChannel } from '../../integrations/channels/channels';
import { ENV, type Env } from '../../config/env';
import { TEMPLATES, type TemplateVars } from './templates';

export type Channel = 'in_app' | 'sms' | 'email' | 'telegram' | 'viber' | 'whatsapp' | 'push';
export type InAppEvent = { id: string; userId: string; title: string; body: string; link?: string; template: string };
export type NotifyInput = { userId?: string | null; template: string; vars?: TemplateVars; link?: string; channels?: Channel[]; to?: Partial<Record<Channel, string>>; category?: string };

const DEFAULT_CHANNELS: Record<string, Channel[]> = {
  liveness: ['sms', 'in_app'],
  offers: ['in_app', 'sms'],
  listing_alert: ['in_app', 'email'],
  messages: ['in_app'],
  viewings: ['in_app', 'sms', 'email'],
  crm: ['in_app', 'telegram'],
  billing: ['in_app', 'email'],
};

/** Channel router: renders a template, respects user prefs, writes in-app row, queues external sends. */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger('Notifications');
  private readonly inAppListeners: ((n: InAppEvent) => void)[] = [];
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    @Inject(SMS) private readonly sms: SmsProvider,
    @Inject(CHANNELS) private readonly channels: Record<string, MessageChannel>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('notifications.send', (d: { id: string }) => this.deliver(d.id));
  }

  async notify(input: NotifyInput) {
    const tpl = TEMPLATES[input.template] ?? TEMPLATES.generic!;
    const vars = input.vars ?? {};
    const title = tpl.title(vars);
    const body = tpl.body(vars);
    const user = input.userId ? await this.dbs.db.query.users.findFirst({ where: and(eq(users.id, input.userId), isNull(users.deletedAt)) }) : null;
    const category = input.category ?? input.template.split('_')[0]!;
    const prefs = user?.notificationPrefs?.[category];
    const channels = [...new Set<Channel>(input.channels ?? (prefs as Channel[] | undefined) ?? DEFAULT_CHANNELS[category] ?? ['in_app'])];
    // Mobile (V7): users with a registered device also get in-app notifications as push.
    const pushTokens = user?.notificationPrefs?.pushTokens ?? [];
    if (pushTokens.length && channels.includes('in_app') && !channels.includes('push')) channels.push('push');
    const address = (c: Channel): string | null => {
      if (input.to?.[c]) return input.to[c]!;
      if (!user) return null;
      if (c === 'sms' || c === 'whatsapp') return user.phone;
      if (c === 'email') return user.email;
      if (c === 'telegram') return user.telegramChatId;
      if (c === 'viber') return user.viberId;
      if (c === 'push' && pushTokens.length) return pushTokens.join(',');
      return user.id;
    };
    const link = input.link ? (input.link.startsWith('http') ? input.link : `${this.env.APP_URL}${input.link}`) : undefined;
    const created: string[] = [];
    for (const channel of channels) {
      const to = channel === 'in_app' ? null : address(channel);
      if (channel !== 'in_app' && !to) continue;
      const [row] = await this.dbs.db
        .insert(notifications)
        .values({ userId: user?.id ?? null, channel, template: input.template, to, title, body, link: input.link, payload: vars as object, status: channel === 'in_app' ? 'sent' : 'queued', sentAt: channel === 'in_app' ? new Date() : null })
        .returning({ id: notifications.id });
      created.push(row!.id);
      if (channel === 'in_app' && user) for (const fn of this.inAppListeners) fn({ id: row!.id, userId: user.id, title, body, link: input.link, template: input.template });
      if (channel !== 'in_app') await this.queue.add('notifications.send', { id: row!.id });
    }
    void link;
    return created;
  }

  /** Realtime push hook (WebSocket gateway subscribes to in-app notifications). */
  onInApp(fn: (n: InAppEvent) => void) {
    this.inAppListeners.push(fn);
  }

  async deliver(id: string) {
    const n = await this.dbs.db.query.notifications.findFirst({ where: eq(notifications.id, id) });
    if (!n || n.status !== 'queued' || !n.to) return;
    const link = n.link ? (n.link.startsWith('http') ? n.link : `${this.env.APP_URL}${n.link}`) : undefined;
    try {
      if (n.channel === 'sms') await this.sms.send(n.to, `${n.title}: ${n.body}${link ? ` ${link}` : ''}`.slice(0, 480));
      else await this.channels[n.channel]!.send({ to: n.to, title: n.title ?? undefined, body: n.body ?? '', link });
      await this.dbs.db.update(notifications).set({ status: 'sent', sentAt: new Date() }).where(eq(notifications.id, id));
    } catch (e) {
      this.logger.warn(`delivery ${id} via ${n.channel} failed: ${(e as Error).message}`);
      await this.dbs.db.update(notifications).set({ status: 'failed', error: (e as Error).message }).where(eq(notifications.id, id));
      throw e;
    }
  }

  list(userId: string, limit = 30) {
    return this.dbs.db.query.notifications.findMany({ where: and(eq(notifications.userId, userId), eq(notifications.channel, 'in_app')), orderBy: desc(notifications.createdAt), limit });
  }

  async markRead(userId: string, id?: string) {
    const where = id ? and(eq(notifications.userId, userId), eq(notifications.id, id)) : and(eq(notifications.userId, userId), isNull(notifications.readAt));
    await this.dbs.db.update(notifications).set({ readAt: new Date() }).where(where);
    return { ok: true };
  }
}
