import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { and, desc, eq, gt, isNull, memberships, organizations, otpCodes, sessions, users } from '@lokacia/db';
import type { SessionUser } from '@lokacia/contracts';
import { ENV, type Env } from '../../config/env';
import { DbService } from '../../common/db.service';
import { problems, ProblemException } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import { ACCESS_TTL_S, IMPERSONATION_TTL_S, REFRESH_TTL_S, TokensService } from '../../common/tokens.service';
import { SMS, type SmsProvider } from '../../integrations/sms/sms';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  constructor(
    private readonly dbs: DbService,
    private readonly tokens: TokensService,
    private readonly rate: RateLimitService,
    @Inject(SMS) private readonly sms: SmsProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async verifyTurnstile(token: string | undefined, ip: string) {
    if (!this.env.TURNSTILE_SECRET) return;
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: this.env.TURNSTILE_SECRET, response: token ?? '', remoteip: ip }),
    });
    const json = (await res.json()) as { success: boolean };
    if (!json.success) throw new ProblemException(403, 'bot-check', 'ბოტის შემოწმება ვერ გაიარა');
  }

  async requestOtp(phone: string, ip: string, turnstileToken?: string) {
    await this.verifyTurnstile(turnstileToken, ip);
    await this.rate.hit(`otp:phone:${phone}`, 5, 3600);
    await this.rate.hit(`otp:ip:${ip}`, 20, 3600);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.dbs.db.insert(otpCodes).values({ phone, codeHash: this.tokens.hash(`${phone}:${code}`), expiresAt: new Date(Date.now() + 5 * 60_000), ip });
    await this.sms.send(phone, `lokacia.ge კოდი: ${code}`);
    return { sent: true, expiresInSec: 300, devCode: this.env.NODE_ENV !== 'production' ? this.env.OTP_DEV_CODE : undefined };
  }

  async verifyOtp(phone: string, code: string, name: string | undefined, meta: { ip: string; userAgent?: string }) {
    await this.rate.hit(`otp:verify:${phone}`, 10, 900);
    await this.rate.hit(`otp:verify:ip:${meta.ip}`, 30, 900);
    const devOk = this.env.NODE_ENV !== 'production' && !!this.env.OTP_DEV_CODE && code === this.env.OTP_DEV_CODE;
    if (!devOk) {
      const otp = await this.dbs.db.query.otpCodes.findFirst({
        where: and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())),
        orderBy: desc(otpCodes.createdAt),
      });
      if (!otp || otp.attempts >= 5) throw new ProblemException(401, 'otp-invalid', 'კოდი არასწორია ან ვადა გაუვიდა');
      if (!this.tokens.safeEqual(otp.codeHash, this.tokens.hash(`${phone}:${code}`))) {
        await this.dbs.db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
        throw new ProblemException(401, 'otp-invalid', 'კოდი არასწორია ან ვადა გაუვიდა');
      }
      await this.dbs.db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
    }

    let user = await this.dbs.db.query.users.findFirst({ where: and(eq(users.phone, phone), isNull(users.deletedAt)) });
    if (!user) {
      [user] = await this.dbs.db.insert(users).values({ phone, name: name ?? null, verifiedAt: new Date(), consentAt: new Date() }).returning();
      // accept pending org invites for this phone
      await this.dbs.db
        .update(memberships)
        .set({ userId: user!.id, acceptedAt: new Date(), invitedPhone: null })
        .where(and(eq(memberships.invitedPhone, phone), isNull(memberships.userId)));
    }
    if (user!.bannedAt) throw new ProblemException(403, 'banned', 'ანგარიში დაბლოკილია', user!.banReason ?? undefined);
    return this.issue(user!.id, user!.role, meta);
  }

  async issue(userId: string, role: SessionUser['role'], meta: { ip: string; userAgent?: string }, familyId = uuidv7(), impersonatorId: string | null = null, expiresAt?: Date) {
    const refresh = this.tokens.newRefreshToken();
    const ttl = impersonatorId ? IMPERSONATION_TTL_S : REFRESH_TTL_S;
    const [session] = await this.dbs.db
      .insert(sessions)
      .values({ userId, familyId, tokenHash: this.tokens.hash(refresh), expiresAt: expiresAt ?? new Date(Date.now() + ttl * 1000), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300), impersonatorId })
      .returning();
    const access = this.tokens.signAccess({ sub: userId, role, sid: session!.id, imp: impersonatorId });
    await this.dbs.db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
    return { access, refresh, sessionId: session!.id, expiresIn: ACCESS_TTL_S };
  }

  /** Rotating refresh: old token revoked, reuse of a revoked token revokes the whole family. */
  async refresh(refreshToken: string, meta: { ip: string; userAgent?: string }) {
    const hash = this.tokens.hash(refreshToken);
    const session = await this.dbs.db.query.sessions.findFirst({ where: eq(sessions.tokenHash, hash) });
    if (!session) throw problems.unauthorized();
    if (session.revokedAt) {
      this.logger.warn(`refresh token reuse detected for user ${session.userId}; revoking family`);
      await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.familyId, session.familyId), isNull(sessions.revokedAt)));
      throw problems.unauthorized();
    }
    if (session.expiresAt < new Date()) throw problems.unauthorized();
    const user = await this.dbs.db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user || user.bannedAt || user.deletedAt) throw problems.unauthorized();
    // claim the session atomically: two concurrent refreshes with the same token → only one wins, the other is reuse
    const claimed = await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt))).returning({ id: sessions.id });
    if (!claimed.length) {
      this.logger.warn(`concurrent refresh token reuse for user ${session.userId}; revoking family`);
      await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.familyId, session.familyId), isNull(sessions.revokedAt)));
      throw problems.unauthorized();
    }
    // impersonation sessions keep their original (short) expiry; normal sessions slide
    const issued = await this.issue(user.id, user.role, meta, session.familyId, session.impersonatorId, session.impersonatorId ? session.expiresAt : undefined);
    await this.dbs.db.update(sessions).set({ replacedById: issued.sessionId }).where(eq(sessions.id, session.id));
    return issued;
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, this.tokens.hash(refreshToken)));
  }

  async logoutAll(userId: string) {
    await this.dbs.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async me(userId: string, impersonatorId?: string | null): Promise<SessionUser> {
    const user = await this.dbs.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw problems.unauthorized();
    const orgs = await this.dbs.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, type: organizations.type, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.userId, userId), eq(memberships.active, true), isNull(memberships.deletedAt), isNull(organizations.deletedAt)));
    return { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, avatarUrl: user.avatarUrl, locale: user.locale, slug: user.slug, orgs, impersonatorId: impersonatorId ?? null };
  }

  /** Google OAuth (code flow). Hidden in UI when GOOGLE_CLIENT_ID is empty. */
  googleAuthUrl(state: string) {
    const q = new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: `${this.env.APP_URL}/api/v1/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  async googleCallback(code: string, meta: { ip: string; userAgent?: string }) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ code, client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET, redirect_uri: `${this.env.APP_URL}/api/v1/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    const tok = (await tokenRes.json()) as { id_token?: string };
    if (!tok.id_token) throw problems.unauthorized();
    const info = (await (await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tok.id_token)}`)).json()) as { sub: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; aud: string; iss?: string; exp?: string };
    if (info.aud !== this.env.GOOGLE_CLIENT_ID) throw problems.unauthorized();
    if (info.iss && info.iss !== 'https://accounts.google.com' && info.iss !== 'accounts.google.com') throw problems.unauthorized();
    if (info.exp && Number(info.exp) * 1000 < Date.now()) throw problems.unauthorized();
    const user = await this.resolveGoogleUser(info);
    return this.issue(user.id, user.role, meta);
  }

  /**
   * Google identity → account. Matches by Google `sub` only. An existing account with the same e-mail is NOT linked
   * automatically: profile e-mails are not verified, so anyone could pre-set a victim's address on their own account
   * and capture the victim's Google login (account pre-hijacking).
   */
  async resolveGoogleUser(info: { sub: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string }) {
    let user = await this.dbs.db.query.users.findFirst({ where: and(eq(users.googleId, info.sub), isNull(users.deletedAt)) });
    if (!user) {
      const verified = info.email_verified === true || info.email_verified === 'true';
      const email = info.email && verified ? info.email.toLowerCase() : null;
      if (email) {
        const taken = await this.dbs.db.query.users.findFirst({ where: and(eq(users.email, email), isNull(users.deletedAt)) });
        if (taken) throw new ProblemException(409, 'account-exists', 'ეს ელ-ფოსტა უკვე გამოყენებულია', 'შედით ტელეფონის ნომრით');
      }
      [user] = await this.dbs.db.insert(users).values({ googleId: info.sub, email, name: info.name, avatarUrl: info.picture, verifiedAt: new Date(), consentAt: new Date() }).returning();
    }
    if (user!.bannedAt) throw new ProblemException(403, 'banned', 'ანგარიში დაბლოკილია', user!.banReason ?? undefined);
    return user!;
  }
}
