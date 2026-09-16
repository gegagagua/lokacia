import { Inject, Injectable } from '@nestjs/common';
import { and, conversations, crmContacts, desc, eq, inArray, isNull, listings, memberships, messages, organizations, sql, users, type SQL } from '@lokacia/db';
import { normalizePhone, type InboxChannel, type InboxConversation, type InboxMessage } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { ProblemException, problems } from '../../../common/problem';
import { ENV, type Env } from '../../../config/env';
import { CHANNELS, type MessageChannel } from '../../../integrations/channels/channels';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import type { CrmCtx } from '../shared/crm-access';
import { CrmEventsService } from '../shared/crm-events.service';

type ConvRow = typeof conversations.$inferSelect;
type ExternalChannel = 'whatsapp' | 'viber' | 'telegram';

/**
 * C6 unified inbox. Portal conversations about the org's listings (read from the messaging tables owned by the portal
 * stream) + WhatsApp / Viber / Telegram conversations created by channel webhooks (adapters mocked in dev).
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
    private readonly events: CrmEventsService,
    private readonly notify: NotificationsService,
    @Inject(CHANNELS) private readonly channels: Record<string, MessageChannel>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async memberIds(orgId: string) {
    const rows = await this.dbs.db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, orgId), isNull(memberships.deletedAt)));
    return rows.map((r) => r.userId).filter((x): x is string => !!x);
  }

  /** Conversations visible to the org: org-owned channel conversations + portal conversations about org listings. */
  private visible(orgId: string): SQL {
    return sql`(${conversations.orgId} = ${orgId} OR (${conversations.channel} = 'portal' AND ${conversations.listingId} IN (SELECT id FROM listings WHERE org_id = ${orgId})))`;
  }

  private unreadExpr(members: string[]) {
    const arr = `{${members.join(',')}}`;
    return sql<number>`(SELECT count(*)::int FROM messages m WHERE m.conversation_id = "conversations"."id" AND m.read_at IS NULL AND m.deleted_at IS NULL AND (m.direction = 'in' OR (m.sender_id IS NOT NULL AND NOT (m.sender_id = ANY(${arr}::uuid[])))))`;
  }

  async list(ctx: CrmCtx, q: { q?: string; channel?: string } = {}): Promise<InboxConversation[]> {
    const members = await this.memberIds(ctx.orgId);
    const where: SQL[] = [isNull(conversations.deletedAt), this.visible(ctx.orgId)];
    if (q.channel) where.push(eq(conversations.channel, q.channel as InboxChannel));
    const rows = await this.dbs.db
      .select({ c: conversations, unread: this.unreadExpr(members), last: sql<string | null>`(SELECT body FROM messages m WHERE m.conversation_id = "conversations"."id" AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1)` })
      .from(conversations)
      .where(and(...where))
      .orderBy(sql`${conversations.lastMessageAt} desc nulls last`)
      .limit(300);
    const out = await this.toDtos(ctx, rows.map((r) => r.c), members, new Map(rows.map((r) => [r.c.id, { unread: Number(r.unread), last: r.last }])));
    const term = q.q?.trim().toLowerCase();
    return term ? out.filter((c) => [c.contactName, c.counterpart, c.subject, c.listingTitle, c.lastMessage, c.externalId].some((v) => v?.toLowerCase().includes(term))) : out;
  }

  private async toDtos(ctx: CrmCtx, rows: ConvRow[], members: string[], extra: Map<string, { unread: number; last: string | null }>): Promise<InboxConversation[]> {
    const contactIds = [...new Set(rows.map((r) => r.contactId).filter((x): x is string => !!x))];
    const contacts = contactIds.length ? await this.dbs.org(ctx.orgId, (tx) => tx.select({ id: crmContacts.id, name: crmContacts.name, phones: crmContacts.phones }).from(crmContacts).where(inArray(crmContacts.id, contactIds))) : [];
    const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x))];
    const ls = listingIds.length ? await this.dbs.db.select({ id: listings.id, title: listings.title }).from(listings).where(inArray(listings.id, listingIds)) : [];
    const outsiderIds = [...new Set(rows.flatMap((r) => r.participantIds.filter((p) => !members.includes(p))))];
    const outsiders = outsiderIds.length ? await this.dbs.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, outsiderIds)) : [];
    const c = new Map(contacts.map((x) => [x.id, x]));
    const l = new Map(ls.map((x) => [x.id, x.title]));
    const u = new Map(outsiders.map((x) => [x.id, x]));
    return rows.map((r) => {
      const outsider = r.participantIds.map((p) => u.get(p)).find(Boolean);
      const contact = r.contactId ? c.get(r.contactId) : undefined;
      return {
        id: r.id,
        channel: r.channel,
        subject: r.subject,
        externalId: r.externalId,
        listingId: r.listingId,
        listingTitle: r.listingId ? (l.get(r.listingId) ?? null) : null,
        contactId: contact ? r.contactId : null,
        contactName: contact?.name ?? null,
        contactPhone: contact?.phones[0] ?? outsider?.phone ?? (r.channel !== 'telegram' ? r.externalId : null),
        counterpart: contact?.name ?? outsider?.name ?? r.subject ?? r.externalId,
        lastMessage: extra.get(r.id)?.last ?? null,
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        unread: extra.get(r.id)?.unread ?? 0,
      };
    });
  }

  private async findConv(ctx: CrmCtx, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('საუბარი');
    const [row] = await this.dbs.db.select().from(conversations).where(and(eq(conversations.id, id), isNull(conversations.deletedAt), this.visible(ctx.orgId)));
    if (!row) throw problems.notFound('საუბარი');
    return row;
  }

  async get(ctx: CrmCtx, id: string) {
    const conv = await this.findConv(ctx, id);
    const members = await this.memberIds(ctx.orgId);
    const [row] = await this.dbs.db.select({ unread: this.unreadExpr(members) }).from(conversations).where(eq(conversations.id, id));
    return (await this.toDtos(ctx, [conv], members, new Map([[id, { unread: Number(row?.unread ?? 0), last: null }]])))[0]!;
  }

  async messages(ctx: CrmCtx, id: string): Promise<InboxMessage[]> {
    await this.findConv(ctx, id);
    const members = await this.memberIds(ctx.orgId);
    const rows = await this.dbs.db.select().from(messages).where(and(eq(messages.conversationId, id), isNull(messages.deletedAt))).orderBy(desc(messages.createdAt)).limit(300);
    // mark inbound as read
    const inboundUnread = rows.filter((m) => !m.readAt && (m.direction === 'in' || (m.senderId && !members.includes(m.senderId))));
    if (inboundUnread.length) await this.dbs.db.update(messages).set({ readAt: new Date() }).where(inArray(messages.id, inboundUnread.map((m) => m.id)));
    const senderIds = [...new Set(rows.map((m) => m.senderId).filter((x): x is string => !!x))];
    const senders = senderIds.length ? await this.dbs.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, senderIds)) : [];
    const names = new Map(senders.map((s) => [s.id, s.name]));
    return rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      // from the agency's point of view: anything sent by an org member is outbound
      direction: m.direction === 'in' || (m.senderId && !members.includes(m.senderId)) ? 'in' : 'out',
      senderId: m.senderId,
      senderName: m.senderId ? (names.get(m.senderId) ?? null) : null,
      externalSender: m.externalSender,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    }));
  }

  async reply(ctx: CrmCtx, id: string, body: string) {
    const conv = await this.findConv(ctx, id);
    const now = new Date();
    if (conv.channel === 'portal') {
      if (!conv.participantIds.includes(ctx.userId)) await this.dbs.db.update(conversations).set({ participantIds: [...conv.participantIds, ctx.userId] }).where(eq(conversations.id, id));
      const members = await this.memberIds(ctx.orgId);
      const sender = await this.dbs.db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
      for (const p of conv.participantIds.filter((p) => !members.includes(p))) {
        await this.notify.notify({ userId: p, template: 'message_new', vars: { from: sender?.name ?? 'ბროკერი', body: body.slice(0, 140) }, link: `/account/messages?c=${id}`, category: 'messages' });
      }
    } else {
      if (!conv.externalId) throw problems.badRequest('საუბარს არ აქვს ადრესატი');
      const channel = this.channels[conv.channel];
      if (!channel) throw problems.badRequest(`არხი ${conv.channel} მიუწვდომელია`);
      try {
        await channel.send({ to: conv.externalId, body });
      } catch (e) {
        throw new ProblemException(502, 'channel-failed', 'შეტყობინება არ გაიგზავნა', (e as Error).message);
      }
    }
    const [m] = await this.dbs.db.insert(messages).values({ conversationId: id, senderId: ctx.userId, body, direction: 'out', createdAt: now }).returning();
    await this.dbs.db.update(conversations).set({ lastMessageAt: now, orgId: conv.orgId ?? ctx.orgId }).where(eq(conversations.id, id));
    if (conv.contactId) await this.activities.log(ctx.orgId, { entity: 'contact', entityId: conv.contactId, type: 'message', payload: { conversationId: id, channel: conv.channel, direction: 'out', body: body.slice(0, 500) }, createdBy: ctx.userId });
    return (await this.messages(ctx, id)).find((x) => x.id === m!.id);
  }

  async link(ctx: CrmCtx, id: string, contactId: string | null) {
    const conv = await this.findConv(ctx, id);
    if (contactId) {
      const c = await this.dbs.org(ctx.orgId, (tx) => tx.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, contactId), isNull(crmContacts.deletedAt)) }));
      if (!c) throw problems.notFound('კონტაქტი');
    }
    await this.dbs.db.update(conversations).set({ contactId, orgId: conv.orgId ?? ctx.orgId }).where(eq(conversations.id, id));
    return this.get(ctx, id);
  }

  /** Inbound message from an external channel (webhook or dev simulation). */
  async inbound(orgId: string, channel: ExternalChannel, input: { from: string; name?: string; text: string }) {
    const org = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)) });
    if (!org) throw problems.notFound('ორგანიზაცია');
    const phone = channel === 'telegram' && !/^\+?\d{9,15}$/.test(input.from.replace(/[\s-]/g, '')) ? null : normalizePhone(input.from);
    const externalId = phone ?? input.from;
    let [conv] = await this.dbs.db.select().from(conversations).where(and(eq(conversations.orgId, orgId), eq(conversations.channel, channel), eq(conversations.externalId, externalId), isNull(conversations.deletedAt)));

    let contactId = conv?.contactId ?? null;
    let createdContact = false;
    if (!contactId) {
      contactId = await this.dbs.org(orgId, async (tx) => {
        if (phone) {
          const digits = phone.replace(/\D/g, '').slice(-9);
          const [match] = await tx
            .select({ id: crmContacts.id })
            .from(crmContacts)
            .where(and(isNull(crmContacts.deletedAt), isNull(crmContacts.mergedIntoId), sql`EXISTS (SELECT 1 FROM unnest(${crmContacts.phones}) p WHERE right(regexp_replace(p, '\\D', '', 'g'), 9) = ${digits})`))
            .orderBy(crmContacts.createdAt)
            .limit(1);
          if (match) return match.id;
        }
        const [created] = await tx
          .insert(crmContacts)
          .values({ orgId, type: 'client', name: input.name?.trim() || phone || `${channel} ${input.from}`, phones: phone ? [phone] : [], source: channel, notes: phone ? null : `${channel}: ${input.from}`, lastContactedAt: new Date() })
          .returning({ id: crmContacts.id });
        createdContact = true;
        return created!.id;
      });
    }
    const now = new Date();
    if (!conv) {
      [conv] = await this.dbs.db.insert(conversations).values({ orgId, channel, externalId, contactId, subject: input.name ?? externalId, lastMessageAt: now }).returning();
    } else {
      await this.dbs.db.update(conversations).set({ lastMessageAt: now, contactId }).where(eq(conversations.id, conv.id));
    }
    const [msg] = await this.dbs.db.insert(messages).values({ conversationId: conv!.id, direction: 'in', externalSender: input.from, body: input.text, createdAt: now }).returning();
    if (createdContact) await this.events.emit('contact.created', { orgId, contactId, actorId: null, source: channel });
    const contact = await this.dbs.org(orgId, async (tx) => {
      await tx.update(crmContacts).set({ lastContactedAt: now }).where(eq(crmContacts.id, contactId!));
      return tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, contactId!) });
    });
    await this.activities.log(orgId, { entity: 'contact', entityId: contactId, type: 'message', payload: { conversationId: conv!.id, channel, direction: 'in', body: input.text.slice(0, 500) } });
    await this.events.emit('message.inbound', { orgId, conversationId: conv!.id, contactId, channel });
    const recipients = contact?.ownerAgentId
      ? [contact.ownerAgentId]
      : (await this.dbs.db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.role, 'manager'), eq(memberships.active, true), isNull(memberships.deletedAt)))).map((m) => m.userId!).filter(Boolean);
    for (const userId of recipients) {
      await this.notify.notify({ userId, template: 'crm_inbox_message', vars: { channel, from: contact?.name ?? input.from, body: input.text.slice(0, 140) }, channels: ['in_app'], link: `${this.env.CRM_URL}/inbox?c=${conv!.id}`, category: 'crm' });
    }
    return { conversationId: conv!.id, messageId: msg!.id, contactId, createdContact };
  }
}
