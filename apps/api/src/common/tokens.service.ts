import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { Role } from '@lokacia/contracts';
import { ENV, type Env } from '../config/env';

export const ACCESS_COOKIE = 'lk_at';
export const REFRESH_COOKIE = 'lk_rt';
export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_S = 30 * 24 * 3600;

export type AccessPayload = { sub: string; role: Role; sid: string; imp?: string | null };

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  signAccess(p: AccessPayload) {
    return this.jwt.sign(p, { secret: this.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL_S });
  }

  verifyAccess(token: string): AccessPayload | null {
    try {
      return this.jwt.verify<AccessPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      return null;
    }
  }

  newRefreshToken() {
    return randomBytes(32).toString('base64url');
  }

  hash(value: string) {
    return createHash('sha256').update(`${value}:${this.env.JWT_REFRESH_SECRET}`).digest('hex');
  }

  hmac(value: string, secret = this.env.JWT_REFRESH_SECRET) {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  safeEqual(a: string, b: string) {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  ipHash(ip: string) {
    return createHash('sha256').update(`${ip}:${this.env.IP_HASH_SALT}`).digest('hex').slice(0, 32);
  }

  setAuthCookies(res: Response, access: string, refresh: string) {
    const secure = this.env.NODE_ENV === 'production';
    const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', domain: this.env.COOKIE_DOMAIN || undefined };
    res.cookie(ACCESS_COOKIE, access, { ...base, maxAge: ACCESS_TTL_S * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, maxAge: REFRESH_TTL_S * 1000 });
  }

  clearAuthCookies(res: Response) {
    const base = { path: '/', domain: this.env.COOKIE_DOMAIN || undefined };
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }
}
