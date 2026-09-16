import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  and, consents, eq, favorites, isNull, listings, messages, offers, savedSearches, sessions, tenantProfiles, users, viewings, demandRequests, notifications, reviews,
} from '@lokacia/db';
import { profileUpdateSchema, tenantProfileSchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import type { AuthUser } from '../../common/request';
import { TokensService } from '../../common/tokens.service';
import { ApiZodBody, ZBody } from '../../common/zod';

const consentSchema = z.object({ kind: z.string().min(1).max(60), granted: z.boolean() });

@ApiTags('users')
@Controller('v1/users')
export class UsersController {
  constructor(
    private readonly dbs: DbService,
    private readonly tokens: TokensService,
  ) {}

  @Patch('me')
  @ApiZodBody(profileUpdateSchema)
  async update(@CurrentUser() user: AuthUser, @ZBody(profileUpdateSchema) body: z.infer<typeof profileUpdateSchema>) {
    const [u] = await this.dbs.db.update(users).set(body).where(eq(users.id, user.id)).returning();
    return { id: u!.id, name: u!.name, email: u!.email, avatarUrl: u!.avatarUrl, locale: u!.locale, notificationPrefs: u!.notificationPrefs, bio: u!.bio };
  }

  @Get('me/settings')
  async settings(@CurrentUser() user: AuthUser) {
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!u) throw problems.notFound();
    return { notificationPrefs: u.notificationPrefs, telegramLinked: !!u.telegramChatId, viberLinked: !!u.viberId, email: u.email, bio: u.bio, consentAt: u.consentAt };
  }

  @Get('me/tenant-profile')
  async tenant(@CurrentUser() user: AuthUser) {
    return (await this.dbs.db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, user.id) })) ?? null;
  }

  @Put('me/tenant-profile')
  @ApiZodBody(tenantProfileSchema)
  async upsertTenant(@CurrentUser() user: AuthUser, @ZBody(tenantProfileSchema) body: z.infer<typeof tenantProfileSchema>) {
    const [row] = await this.dbs.db
      .insert(tenantProfiles)
      .values({ userId: user.id, ...body })
      .onConflictDoUpdate({ target: tenantProfiles.userId, set: { ...body, updatedAt: new Date() } })
      .returning();
    return row;
  }

  /** Tenant profile as seen by an owner (P20): only when there is an offer/viewing between them. */
  @Get(':id/tenant-profile')
  async tenantFor(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const related =
      me.role === 'admin' || me.role === 'moderator' || me.id === id
        ? true
        : !!(await this.dbs.db.query.offers.findFirst({ where: and(eq(offers.fromUserId, id), eq(offers.toUserId, me.id)) })) ||
          !!(await this.dbs.db
            .select({ id: viewings.id })
            .from(viewings)
            .innerJoin(listings, eq(listings.id, viewings.listingId))
            .where(and(eq(viewings.userId, id), eq(listings.ownerId, me.id)))
            .limit(1)
            .then((r) => r[0]));
    if (!related) throw problems.forbidden();
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, id) });
    const profile = await this.dbs.db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, id) });
    if (!u) throw problems.notFound('მომხმარებელი');
    return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, memberSince: u.createdAt, verified: !!u.verifiedAt, profile: profile ?? null };
  }

  @Post('me/consents')
  @ApiZodBody(consentSchema)
  async consent(@CurrentUser() user: AuthUser, @ZBody(consentSchema) body: z.infer<typeof consentSchema>, @ClientIp() ip: string) {
    const [row] = await this.dbs.db.insert(consents).values({ userId: user.id, kind: body.kind, granted: body.granted, ip }).returning();
    return row;
  }

  /** Personal data export (Georgian PDP law). */
  @Get('me/export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const db = this.dbs.db;
    const data = {
      exportedAt: new Date().toISOString(),
      user: await db.query.users.findFirst({ where: eq(users.id, user.id) }),
      tenantProfile: await db.query.tenantProfiles.findFirst({ where: eq(tenantProfiles.userId, user.id) }),
      listings: await db.query.listings.findMany({ where: eq(listings.ownerId, user.id) }),
      favorites: await db.query.favorites.findMany({ where: eq(favorites.userId, user.id) }),
      savedSearches: await db.query.savedSearches.findMany({ where: eq(savedSearches.userId, user.id) }),
      demandRequests: await db.query.demandRequests.findMany({ where: eq(demandRequests.userId, user.id) }),
      offers: await db.query.offers.findMany({ where: eq(offers.fromUserId, user.id) }),
      viewings: await db.query.viewings.findMany({ where: eq(viewings.userId, user.id) }),
      messages: await db.query.messages.findMany({ where: eq(messages.senderId, user.id) }),
      consents: await db.query.consents.findMany({ where: eq(consents.userId, user.id) }),
    };
    res.setHeader('content-disposition', `attachment; filename="lokacia-data-${user.id}.json"`);
    res.json(data);
  }

  /** Account deletion: anonymize personal data, archive listings, revoke sessions. */
  @Delete('me')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthUser) {
    await this.dbs.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ phone: null, email: null, name: 'წაშლილი მომხმარებელი', avatarUrl: null, googleId: null, telegramChatId: null, viberId: null, bio: null, slug: null, deletedAt: new Date() })
        .where(eq(users.id, user.id));
      await tx.delete(tenantProfiles).where(eq(tenantProfiles.userId, user.id));
      await tx.update(listings).set({ status: 'archived' }).where(and(eq(listings.ownerId, user.id), isNull(listings.orgId)));
      await tx.delete(savedSearches).where(eq(savedSearches.userId, user.id));
      await tx.delete(favorites).where(eq(favorites.userId, user.id));
      await tx.delete(notifications).where(eq(notifications.userId, user.id));
      await tx.update(reviews).set({ authorId: null }).where(eq(reviews.authorId, user.id));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, user.id));
    });
    return { ok: true };
  }

  /** Telegram deep link: t.me/<bot>?start=<token>; the bot webhook links chat id. */
  @Post('me/telegram-link')
  async telegramLink(@CurrentUser() user: AuthUser) {
    const token = randomBytes(12).toString('base64url');
    await this.dbs.db.update(users).set({ telegramLinkToken: token }).where(eq(users.id, user.id));
    return { url: `https://t.me/lokacia_ge_bot?start=${token}`, token };
  }

  @Public()
  @Post('telegram/webhook')
  @HttpCode(200)
  async telegramWebhook(@ZBody(z.object({ message: z.object({ chat: z.object({ id: z.union([z.number(), z.string()]) }), text: z.string().optional() }).optional() }).passthrough()) body: { message?: { chat: { id: number | string }; text?: string } }) {
    const text = body.message?.text ?? '';
    const token = text.startsWith('/start ') ? text.slice(7).trim() : null;
    if (token) await this.dbs.db.update(users).set({ telegramChatId: String(body.message!.chat.id), telegramLinkToken: null }).where(eq(users.telegramLinkToken, token));
    return { ok: true };
  }

  /** Demo helper for the mock channel: link Telegram without a real bot. */
  @Post('me/telegram-link/mock-confirm')
  async mockTelegram(@CurrentUser() user: AuthUser) {
    await this.dbs.db.update(users).set({ telegramChatId: `mock-${user.id.slice(0, 8)}`, telegramLinkToken: null }).where(eq(users.id, user.id));
    return { ok: true };
  }

  @Public()
  @Get('brokers/:slug')
  async broker(@Param('slug') slug: string) {
    const u = await this.dbs.db.query.users.findFirst({ where: and(eq(users.slug, slug), isNull(users.deletedAt)) });
    if (!u) throw problems.notFound('ბროკერი');
    return { id: u.id, name: u.name, slug: u.slug, bio: u.bio, avatarUrl: u.avatarUrl, role: u.role, memberSince: u.createdAt };
  }
}
