import { Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  and, consents, eq, isNull, listings, offers, tenantProfiles, users, viewings,
} from '@lokacia/db';
import { addPushToken, profileUpdateSchema, pushTokenSchema, tenantProfileSchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, NoImpersonation, Public } from '../../common/decorators';
import { anonymizeUser, exportUserData } from './privacy';
import { ENV, type Env } from '../../config/env';
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
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Patch('me')
  @ApiZodBody(profileUpdateSchema)
  async update(@CurrentUser() user: AuthUser, @ZBody(profileUpdateSchema) body: z.infer<typeof profileUpdateSchema>) {
    if (body.notificationPrefs) {
      // Device push tokens live in notification_prefs.pushTokens (mobile, V7) — settings forms must not wipe them.
      const cur = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id), columns: { notificationPrefs: true } });
      const pushTokens = cur?.notificationPrefs?.pushTokens;
      body = { ...body, notificationPrefs: { ...body.notificationPrefs, ...(pushTokens ? { pushTokens } : {}) } };
    }
    const [u] = await this.dbs.db.update(users).set(body).where(eq(users.id, user.id)).returning();
    return { id: u!.id, name: u!.name, email: u!.email, avatarUrl: u!.avatarUrl, locale: u!.locale, notificationPrefs: u!.notificationPrefs, bio: u!.bio };
  }

  /** Registers an Expo push token for this device (mobile app, V7). Stored in notification_prefs.pushTokens. */
  @Post('me/push-token')
  @HttpCode(200)
  @ApiZodBody(pushTokenSchema)
  async addPushToken(@CurrentUser() user: AuthUser, @ZBody(pushTokenSchema) body: z.infer<typeof pushTokenSchema>) {
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id), columns: { notificationPrefs: true } });
    if (!u) throw problems.notFound();
    const pushTokens = addPushToken(u.notificationPrefs.pushTokens, body.token);
    await this.dbs.db.update(users).set({ notificationPrefs: { ...u.notificationPrefs, pushTokens }, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true, devices: pushTokens.length };
  }

  /** Unregisters a device token (logout on the phone). */
  @Delete('me/push-token')
  @HttpCode(200)
  @ApiZodBody(pushTokenSchema)
  async removePushToken(@CurrentUser() user: AuthUser, @ZBody(pushTokenSchema) body: z.infer<typeof pushTokenSchema>) {
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, user.id), columns: { notificationPrefs: true } });
    if (!u) throw problems.notFound();
    const pushTokens = (u.notificationPrefs.pushTokens ?? []).filter((t) => t !== body.token);
    await this.dbs.db.update(users).set({ notificationPrefs: { ...u.notificationPrefs, pushTokens }, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true, devices: pushTokens.length };
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

  /** Latest consent decision per kind. */
  @Get('me/consents')
  async consentsList(@CurrentUser() user: AuthUser) {
    const rows = await this.dbs.db.query.consents.findMany({ where: eq(consents.userId, user.id), orderBy: (c, { desc }) => desc(c.createdAt) });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!latest.has(r.kind)) latest.set(r.kind, r);
    return [...latest.values()].map((r) => ({ kind: r.kind, granted: r.granted, at: r.createdAt }));
  }

  /** Personal data export (Georgian PDP law). */
  @Get('me/export')
  @NoImpersonation()
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const data = await exportUserData(this.dbs, user.id);
    res.setHeader('content-disposition', `attachment; filename="lokacia-data-${user.id}.json"`);
    res.setHeader('cache-control', 'no-store');
    res.json(data);
  }

  /** Account deletion: anonymize personal data across portal tables, archive listings, revoke sessions. */
  @Delete('me')
  @NoImpersonation()
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthUser) {
    await this.dbs.db.transaction((tx) => anonymizeUser(tx, user.id));
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
  async telegramWebhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @ZBody(z.object({ message: z.object({ chat: z.object({ id: z.union([z.number(), z.string()]) }), text: z.string().optional() }).optional() }).passthrough()) body: { message?: { chat: { id: number | string }; text?: string } }) {
    // Telegram sends the secret configured with setWebhook(secret_token); required in production
    const expected = this.env.TELEGRAM_WEBHOOK_SECRET;
    if ((expected || this.env.NODE_ENV === 'production') && (!expected || !secret || !this.tokens.safeEqual(secret, expected))) throw problems.forbidden('webhook secret');
    const text = body.message?.text ?? '';
    const token = text.startsWith('/start ') ? text.slice(7).trim() : null;
    if (token) await this.dbs.db.update(users).set({ telegramChatId: String(body.message!.chat.id), telegramLinkToken: null }).where(eq(users.telegramLinkToken, token));
    return { ok: true };
  }

  /** Demo helper for the mock channel: link Telegram without a real bot. */
  @Post('me/telegram-link/mock-confirm')
  async mockTelegram(@CurrentUser() user: AuthUser) {
    if (this.env.NODE_ENV === 'production') throw problems.notFound('მარშრუტი');
    await this.dbs.db.update(users).set({ telegramChatId: `mock-${user.id.slice(0, 8)}`, telegramLinkToken: null }).where(eq(users.id, user.id));
    return { ok: true };
  }

  /** Viber deep link (bot conversation with a context token). */
  @Post('me/viber-link')
  async viberLink() {
    const token = randomBytes(12).toString('base64url');
    return { url: `viber://pa?chatURI=lokacia_ge&context=${token}`, token };
  }

  /** Demo helper for the mock channel: link Viber without a real bot. */
  @Post('me/viber-link/mock-confirm')
  async mockViber(@CurrentUser() user: AuthUser) {
    if (this.env.NODE_ENV === 'production') throw problems.notFound('მარშრუტი');
    await this.dbs.db.update(users).set({ viberId: `mock-${user.id.slice(0, 8)}` }).where(eq(users.id, user.id));
    return { ok: true };
  }

  /** Unlink a messenger channel. */
  @Delete('me/messengers/:channel')
  @HttpCode(200)
  async unlinkMessenger(@CurrentUser() user: AuthUser, @Param('channel') channel: string) {
    if (channel === 'telegram') await this.dbs.db.update(users).set({ telegramChatId: null, telegramLinkToken: null }).where(eq(users.id, user.id));
    else if (channel === 'viber') await this.dbs.db.update(users).set({ viberId: null }).where(eq(users.id, user.id));
    else throw problems.badRequest('channel: telegram ან viber');
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
