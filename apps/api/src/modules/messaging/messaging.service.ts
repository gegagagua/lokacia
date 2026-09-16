import { Inject, Injectable } from '@nestjs/common';
import { and, asc, conversations, desc, eq, inArray, isNull, listingMedia, listings, messages, sql, users } from '@lokacia/db';
import { decodeCursor, encodeCursor, type ConversationDto, type MessageDto } from '@lokacia/contracts';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import { STORAGE, type Storage } from '../../integrations/storage/storage';
import type { AuthUser } from '../../common/request';
import { NotificationsService } from '../notifications/notifications.service';
import { PUBLIC_STATUSES } from '../listings/listing-read.service';
import { RealtimeGateway } from './realtime.gateway';

type MessageRow = typeof messages.$inferSelect;
const toDto = (m: MessageRow): MessageDto => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.body,
  attachments: m.attachments ?? [],
  readAt: m.readAt?.toISOString() ?? null,
  createdAt: m.createdAt.toISOString(),
});

@Injectable()
export class MessagingService {
  constructor(
    private readonly dbs: DbService,
    private readonly notify: NotificationsService,
    private readonly rt: RealtimeGateway,
    private readonly rate: RateLimitService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** Direct messages are only for counterparts: offer parties, viewing visitor ↔ listing host/org, lease/escrow parties, service orders, or an existing thread. */
  async related(a: string, b: string) {
    const [r] = await this.dbs.db.execute<{ ok: boolean }>(sql`SELECT (
      EXISTS (SELECT 1 FROM offers o WHERE o.deleted_at IS NULL AND ((o.from_user_id = ${a} AND o.to_user_id = ${b}) OR (o.from_user_id = ${b} AND o.to_user_id = ${a})))
      OR EXISTS (SELECT 1 FROM viewings v JOIN listings l ON l.id = v.listing_id WHERE v.deleted_at IS NULL AND (
        (v.user_id = ${a} AND (l.owner_id = ${b} OR l.agent_id = ${b} OR EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = l.org_id AND m.user_id = ${b} AND m.active AND m.deleted_at IS NULL)))
        OR (v.user_id = ${b} AND (l.owner_id = ${a} OR l.agent_id = ${a} OR EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = l.org_id AND m.user_id = ${a} AND m.active AND m.deleted_at IS NULL)))))
      OR EXISTS (SELECT 1 FROM leases le WHERE le.deleted_at IS NULL AND ((le.owner_id = ${a} AND le.tenant_id = ${b}) OR (le.owner_id = ${b} AND le.tenant_id = ${a})))
      OR EXISTS (SELECT 1 FROM escrow_accounts e WHERE e.deleted_at IS NULL AND ((e.owner_id = ${a} AND e.tenant_id = ${b}) OR (e.owner_id = ${b} AND e.tenant_id = ${a})))
      OR EXISTS (SELECT 1 FROM service_orders so JOIN service_providers sp ON sp.id = so.provider_id WHERE so.deleted_at IS NULL AND ((so.requester_id = ${a} AND sp.user_id = ${b}) OR (so.requester_id = ${b} AND sp.user_id = ${a})))
      OR EXISTS (SELECT 1 FROM conversations c WHERE c.deleted_at IS NULL AND c.channel = 'portal' AND c.participant_ids @> ARRAY[${a}, ${b}]::uuid[])
    ) AS ok`);
    return !!r?.ok;
  }

  private async participantOf(user: AuthUser, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw problems.notFound('საუბარი');
    const c = await this.dbs.db.query.conversations.findFirst({ where: and(eq(conversations.id, id), isNull(conversations.deletedAt)) });
    if (!c || !c.participantIds.includes(user.id)) throw problems.notFound('საუბარი');
    return c;
  }

  async list(user: AuthUser): Promise<ConversationDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(conversations)
      .where(and(sql`${conversations.participantIds} @> ARRAY[${user.id}]::uuid[]`, isNull(conversations.deletedAt), eq(conversations.channel, 'portal')))
      .orderBy(sql`${conversations.lastMessageAt} DESC NULLS LAST`)
      .limit(200);
    return this.toDtos(user.id, rows);
  }

  private async toDtos(me: string, rows: (typeof conversations.$inferSelect)[]): Promise<ConversationDto[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const unread = await this.dbs.db
      .select({ conversationId: messages.conversationId, n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(inArray(messages.conversationId, ids), isNull(messages.readAt), sql`${messages.senderId} IS DISTINCT FROM ${me}`, isNull(messages.deletedAt)))
      .groupBy(messages.conversationId);
    const unreadBy = new Map(unread.map((u) => [u.conversationId, Number(u.n)]));
    const last = await this.dbs.db.execute<{ conversation_id: string; body: string; created_at: string; sender_id: string | null }>(sql`
      SELECT DISTINCT ON (conversation_id) conversation_id, body, created_at, sender_id FROM messages
      WHERE conversation_id = ANY(${`{${ids.join(',')}}`}::uuid[]) AND deleted_at IS NULL
      ORDER BY conversation_id, created_at DESC`);
    const lastBy = new Map(last.map((m) => [m.conversation_id, m]));
    const otherIds = [...new Set(rows.map((r) => r.participantIds.find((p) => p !== me)).filter((x): x is string => !!x))];
    const others = otherIds.length ? await this.dbs.db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, otherIds)) : [];
    const otherBy = new Map(others.map((o) => [o.id, o]));
    const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x))];
    const ls = listingIds.length ? await this.dbs.db.select({ id: listings.id, slug: listings.slug, title: listings.title }).from(listings).where(inArray(listings.id, listingIds)) : [];
    const covers = listingIds.length
      ? await this.dbs.db
          .select({ listingId: listingMedia.listingId, url: listingMedia.url, variants: listingMedia.variants, sort: listingMedia.sort })
          .from(listingMedia)
          .where(and(inArray(listingMedia.listingId, listingIds), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt)))
          .orderBy(asc(listingMedia.sort))
      : [];
    const coverBy = new Map<string, string>();
    for (const c of covers) if (c.listingId && !coverBy.has(c.listingId)) coverBy.set(c.listingId, c.variants?.sm ?? c.url);
    const listingBy = new Map(ls.map((l) => [l.id, { ...l, cover: coverBy.get(l.id) ?? null }]));
    return rows.map((r) => {
      const otherId = r.participantIds.find((p) => p !== me);
      const lm = lastBy.get(r.id);
      return {
        id: r.id,
        listing: r.listingId ? (listingBy.get(r.listingId) ?? null) : null,
        other: otherId ? (otherBy.get(otherId) ?? { id: otherId, name: null, avatarUrl: null }) : null,
        subject: r.subject,
        lastMessage: lm ? { body: lm.body, at: new Date(lm.created_at).toISOString(), mine: lm.sender_id === me } : null,
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        unread: unreadBy.get(r.id) ?? 0,
      };
    });
  }

  async get(user: AuthUser, id: string) {
    const c = await this.participantOf(user, id);
    return (await this.toDtos(user.id, [c]))[0]!;
  }

  async unreadCount(userId: string) {
    const [r] = await this.dbs.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.participant_ids @> ARRAY[${userId}]::uuid[] AND c.deleted_at IS NULL AND c.channel = 'portal'
        AND m.read_at IS NULL AND m.deleted_at IS NULL AND m.sender_id IS DISTINCT FROM ${userId}`);
    return Number(r?.n ?? 0);
  }

  async startAboutListing(user: AuthUser, listingId: string, body: string) {
    const l = await this.dbs.db.query.listings.findFirst({ where: and(eq(listings.id, listingId), isNull(listings.deletedAt)) });
    if (!l || !(PUBLIC_STATUSES as readonly string[]).includes(l.status)) throw problems.notFound('განცხადება');
    const contactId = l.agentId ?? l.ownerId;
    if (contactId === user.id) throw problems.badRequest('საკუთარ განცხადებაზე შეტყობინება შეუძლებელია');
    return this.startWithUser(user, contactId, body, l.id, l.title);
  }

  /** `/with-user` entry point: counterparts only (prevents unsolicited DMs to any user id seen on the portal). */
  async startWithCounterpart(user: AuthUser, otherId: string, body: string, listingId: string | null) {
    if (otherId !== user.id && user.role !== 'admin' && user.role !== 'moderator' && !(await this.related(user.id, otherId))) {
      throw problems.forbidden('შეტყობინება შესაძლებელია მხოლოდ გარიგების მონაწილესთან');
    }
    return this.startWithUser(user, otherId, body, listingId);
  }

  async startWithUser(user: AuthUser, otherId: string, body: string, listingId: string | null, subject?: string) {
    if (otherId === user.id) throw problems.badRequest('საკუთარ თავს შეტყობინება შეუძლებელია');
    const other = await this.dbs.db.query.users.findFirst({ where: and(eq(users.id, otherId), isNull(users.deletedAt)) });
    if (!other) throw problems.notFound('მომხმარებელი');
    let conv = await this.dbs.db.query.conversations.findFirst({
      where: and(
        sql`${conversations.participantIds} @> ARRAY[${user.id}, ${otherId}]::uuid[]`,
        listingId ? eq(conversations.listingId, listingId) : isNull(conversations.listingId),
        eq(conversations.channel, 'portal'),
        isNull(conversations.deletedAt),
      ),
    });
    if (!conv) {
      let subj = subject ?? null;
      if (!subj && listingId) subj = (await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, listingId) }))?.title ?? null;
      await this.rate.hit(`conv-start:${user.id}`, 20, 3600);
      [conv] = await this.dbs.db.insert(conversations).values({ listingId, participantIds: [user.id, otherId], channel: 'portal', subject: subj }).returning();
    }
    const message = await this.send(user, conv!.id, body, []);
    return { conversationId: conv!.id, message };
  }

  async messages(user: AuthUser, id: string, cursor: string | undefined, limit: number) {
    await this.participantOf(user, id);
    const c = decodeCursor<{ at: string; id: string }>(cursor);
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, id),
          isNull(messages.deletedAt),
          c ? sql`(${messages.createdAt}, ${messages.id}) < (${c.at}::timestamptz, ${c.id}::uuid)` : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? encodeCursor({ at: page.at(-1)!.createdAt.toISOString(), id: page.at(-1)!.id }) : null;
    // oldest → newest for rendering
    return { items: page.reverse().map(toDto), nextCursor };
  }

  async send(user: AuthUser, id: string, body: string, attachments: { url: string; name: string; type: string }[]) {
    const conv = await this.participantOf(user, id);
    await this.rate.hit(`msg-send:${user.id}`, 30, 60);
    await this.rate.hit(`msg-send:h:${user.id}`, 300, 3600);
    // attachments must point at our own uploaded media (no arbitrary/phishing links dressed up as files)
    const mediaPrefix = this.storage.publicUrl('uploads/');
    for (const a of attachments) {
      if (!a.url.startsWith(mediaPrefix) || a.url.includes('..') || !/^[\w:/.%-]+$/.test(a.url)) throw problems.badRequest('დანართის ბმული არასწორია');
    }
    const now = new Date();
    const [m] = await this.dbs.db.insert(messages).values({ conversationId: id, senderId: user.id, body, attachments: attachments.length ? attachments : null, direction: 'out', createdAt: now }).returning();
    await this.dbs.db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, id));
    const dto = toDto(m!);
    const sender = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    for (const p of conv.participantIds) {
      this.rt.toUser(p, 'message', dto);
      if (p === user.id) continue;
      // one in-app notification per unread burst (no spam for every message)
      const earlierUnread = await this.dbs.db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.conversationId, id), isNull(messages.readAt), eq(messages.senderId, user.id), sql`${messages.id} <> ${m!.id}`))
        .limit(1);
      if (!earlierUnread.length) {
        await this.notify.notify({ userId: p, template: 'message_new', vars: { from: sender?.name ?? 'მომხმარებელი', body: body.slice(0, 140) }, link: `/account/messages?c=${id}`, category: 'messages' });
      }
    }
    return dto;
  }

  async markRead(user: AuthUser, id: string) {
    const conv = await this.participantOf(user, id);
    const now = new Date();
    const updated = await this.dbs.db
      .update(messages)
      .set({ readAt: now })
      .where(and(eq(messages.conversationId, id), isNull(messages.readAt), sql`${messages.senderId} IS DISTINCT FROM ${user.id}`))
      .returning({ id: messages.id });
    if (updated.length) for (const p of conv.participantIds) this.rt.toUser(p, 'read', { conversationId: id, readerId: user.id, at: now.toISOString(), ids: updated.map((u) => u.id) });
    return { ok: true, read: updated.length };
  }
}
