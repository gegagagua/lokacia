import {
  and, compareLists, consents, conversations, demandRequests, escrowAccounts, favorites, isNull, leases, listingEvents, listings, memberships, messages, notifications, offers, or,
  prebookings, reportPurchases, reviews, savedSearches, serviceOrders, serviceProviders, sessions, sql, tenantProfiles, users, viewings, eq, type Tx,
} from '@lokacia/db';
import type { DbService } from '../../common/db.service';

export const DELETED_USER_NAME = 'წაშლილი მომხმარებელი';

/**
 * Personal data export (Georgian Law on Personal Data Protection, right of access).
 * Secrets (session token hashes, Telegram link token) are never included.
 */
export async function exportUserData(dbs: DbService, userId: string) {
  const db = dbs.db;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const { telegramLinkToken: _secret, ...user } = u ?? ({} as NonNullable<typeof u>);
  const myConversations = await db.select().from(conversations).where(sql`${conversations.participantIds} @> ARRAY[${userId}]::uuid[]`);
  const convIds = myConversations.map((c) => c.id);
  const provider = await db.query.serviceProviders.findFirst({ where: eq(serviceProviders.userId, userId) });
  return {
    exportedAt: new Date().toISOString(),
    user: u ? user : null,
    tenantProfile: await db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, userId) }),
    listings: await db.query.listings.findMany({ where: eq(listings.ownerId, userId) }),
    favorites: await db.query.favorites.findMany({ where: eq(favorites.userId, userId) }),
    compareLists: await db.query.compareLists.findMany({ where: eq(compareLists.userId, userId) }),
    savedSearches: await db.query.savedSearches.findMany({ where: eq(savedSearches.userId, userId) }),
    demandRequests: await db.query.demandRequests.findMany({ where: eq(demandRequests.userId, userId) }),
    offers: await db.query.offers.findMany({ where: or(eq(offers.fromUserId, userId), eq(offers.toUserId, userId)) }),
    viewings: await db.query.viewings.findMany({ where: eq(viewings.userId, userId) }),
    conversations: myConversations,
    messages: convIds.length ? await db.select().from(messages).where(sql`${messages.conversationId} = ANY(${`{${convIds.join(',')}}`}::uuid[])`) : [],
    serviceProvider: provider ?? null,
    serviceOrders: await db.query.serviceOrders.findMany({ where: provider ? or(eq(serviceOrders.requesterId, userId), eq(serviceOrders.providerId, provider.id)) : eq(serviceOrders.requesterId, userId) }),
    reviewsAuthored: await db.query.reviews.findMany({ where: eq(reviews.authorId, userId) }),
    prebookings: await db.query.prebookings.findMany({ where: eq(prebookings.userId, userId) }),
    leases: await db.query.leases.findMany({ where: or(eq(leases.ownerId, userId), eq(leases.tenantId, userId)) }),
    escrow: await db.query.escrowAccounts.findMany({ where: or(eq(escrowAccounts.ownerId, userId), eq(escrowAccounts.tenantId, userId)) }),
    reportPurchases: await db.query.reportPurchases.findMany({ where: eq(reportPurchases.userId, userId) }),
    memberships: await db.query.memberships.findMany({ where: eq(memberships.userId, userId) }),
    notifications: await db.query.notifications.findMany({ where: eq(notifications.userId, userId) }),
    sessions: (await db.query.sessions.findMany({ where: eq(sessions.userId, userId) })).map(({ tokenHash: _t, ...s }) => s),
    activity: await db.select({ type: listingEvents.type, listingId: listingEvents.listingId, createdAt: listingEvents.createdAt }).from(listingEvents).where(eq(listingEvents.userId, userId)).limit(5000),
    consents: await db.query.consents.findMany({ where: eq(consents.userId, userId) }),
  };
}

/**
 * Account deletion (right to erasure). Anonymizes the user and personal data in every portal table in one transaction.
 * Kept on purpose: messages/offers the counterpart received (their copy of the conversation; sender shows as deleted user),
 * invoices/payments/ledger (accounting law), consents (proof of consent), audit log. CRM contacts belong to agencies
 * (separate controllers of the data) — they are not touched here; see docs/OPERATIONS.md.
 */
export async function anonymizeUser(tx: Tx, userId: string) {
  const now = new Date();
  await tx
    .update(users)
    .set({ phone: null, email: null, name: DELETED_USER_NAME, avatarUrl: null, googleId: null, telegramChatId: null, telegramLinkToken: null, viberId: null, bio: null, slug: null, notificationPrefs: {}, deletedAt: now })
    .where(eq(users.id, userId));
  await tx.delete(tenantProfiles).where(eq(tenantProfiles.userId, userId));
  await tx.update(listings).set({ status: 'archived' }).where(and(eq(listings.ownerId, userId), isNull(listings.orgId)));
  await tx.delete(savedSearches).where(eq(savedSearches.userId, userId));
  await tx.delete(favorites).where(eq(favorites.userId, userId));
  await tx.update(compareLists).set({ deletedAt: now }).where(eq(compareLists.userId, userId));
  await tx.delete(notifications).where(eq(notifications.userId, userId));
  await tx.update(reviews).set({ authorId: null, authorName: DELETED_USER_NAME }).where(eq(reviews.authorId, userId));
  await tx.update(demandRequests).set({ status: 'closed', contactPhone: null, description: null, deletedAt: now }).where(eq(demandRequests.userId, userId));
  await tx.update(serviceProviders).set({ phone: null, deletedAt: now }).where(eq(serviceProviders.userId, userId));
  await tx.update(prebookings).set({ phone: null, message: null, status: 'cancelled' }).where(eq(prebookings.userId, userId));
  await tx.update(viewings).set({ note: null }).where(eq(viewings.userId, userId));
  await tx.update(leases).set({ tenantName: DELETED_USER_NAME, tenantPhone: null }).where(eq(leases.tenantId, userId));
  await tx.update(memberships).set({ active: false, deletedAt: now }).where(eq(memberships.userId, userId));
  await tx.update(listingEvents).set({ userId: null }).where(eq(listingEvents.userId, userId));
  await tx.update(consents).set({ ip: null, userAgent: null }).where(eq(consents.userId, userId));
  await tx.update(sessions).set({ revokedAt: now, ip: null, userAgent: null }).where(eq(sessions.userId, userId));
}
