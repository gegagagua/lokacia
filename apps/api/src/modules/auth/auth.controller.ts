import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { otpRequestSchema, otpVerifySchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public, SkipAudit } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { REFRESH_COOKIE, TokensService } from '../../common/tokens.service';
import { problems } from '../../common/problem';
import { AuthService } from './auth.service';
import type { z } from 'zod';

/** Mobile token mode (V7): `x-client: mobile` → tokens in the JSON body instead of httpOnly cookies. */
function isMobile(req: AppRequest) {
  return String(req.headers['x-client'] ?? '').toLowerCase() === 'mobile';
}
function bodyRefreshToken(req: AppRequest) {
  const t = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  return typeof t === 'string' && t.length > 0 && t.length < 512 ? t : undefined;
}

@ApiTags('auth')
@Controller('v1/auth')
@SkipAudit()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @ApiZodBody(otpRequestSchema)
  request(@ZBody(otpRequestSchema) body: z.infer<typeof otpRequestSchema>, @ClientIp() ip: string) {
    return this.auth.requestOtp(body.phone, ip, body.turnstileToken);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @ApiZodBody(otpVerifySchema)
  async verify(@ZBody(otpVerifySchema) body: z.infer<typeof otpVerifySchema>, @ClientIp() ip: string, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.verifyOtp(body.phone, body.code, body.name, { ip, userAgent: req.headers['user-agent'] });
    const payload = this.tokens.verifyAccess(t.access)!;
    const user = await this.auth.me(payload.sub);
    if (isMobile(req)) return { user, expiresIn: t.expiresIn, accessToken: t.access, refreshToken: t.refresh };
    this.tokens.setAuthCookies(res, t.access, t.refresh);
    return { user, expiresIn: t.expiresIn };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: AppRequest, @ClientIp() ip: string, @Res({ passthrough: true }) res: Response) {
    const mobile = isMobile(req);
    const token = mobile ? bodyRefreshToken(req) : (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) throw problems.unauthorized();
    if (mobile) {
      const t = await this.auth.refresh(token, { ip, userAgent: req.headers['user-agent'] });
      return { ok: true, expiresIn: t.expiresIn, accessToken: t.access, refreshToken: t.refresh };
    }
    try {
      const t = await this.auth.refresh(token, { ip, userAgent: req.headers['user-agent'] });
      this.tokens.setAuthCookies(res, t.access, t.refresh);
      return { ok: true, expiresIn: t.expiresIn };
    } catch (e) {
      this.tokens.clearAuthCookies(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(isMobile(req) ? bodyRefreshToken(req) : (req.cookies?.[REFRESH_COOKIE] as string | undefined));
    this.tokens.clearAuthCookies(res);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.id);
    this.tokens.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id, user.impersonatorId);
  }

  @Public()
  @Get('providers')
  providers() {
    return { google: this.env.GOOGLE_CLIENT_ID !== '', otpDevCode: this.env.NODE_ENV !== 'production' ? this.env.OTP_DEV_CODE : null };
  }

  @Public()
  @Get('google')
  google(@Res() res: Response) {
    const state = randomBytes(16).toString('base64url');
    res.cookie('lk_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: this.env.NODE_ENV === 'production', maxAge: 600_000, path: '/' });
    res.redirect(this.auth.googleAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: AppRequest, @ClientIp() ip: string, @Res() res: Response) {
    if (!state || state !== req.cookies?.lk_oauth_state) throw problems.unauthorized();
    const t = await this.auth.googleCallback(code, { ip, userAgent: req.headers['user-agent'] });
    this.tokens.setAuthCookies(res, t.access, t.refresh);
    res.redirect(`${this.env.PUBLIC_BASE_PATH.replace(/\/$/, '')}/account`);
  }
}
