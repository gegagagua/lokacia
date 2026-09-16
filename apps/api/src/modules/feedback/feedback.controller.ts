import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { analyticsEvents, feedback } from '@lokacia/db';
import { analyticsEventSchema, feedbackSchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public, SkipAudit } from '../../common/decorators';
import { DbService } from '../../common/db.service';
import { RateLimitService } from '../../common/redis.service';
import { TokensService } from '../../common/tokens.service';
import type { AppRequest, AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';

@ApiTags('feedback')
@Controller('v1')
export class FeedbackController {
  constructor(
    private readonly dbs: DbService,
    private readonly rate: RateLimitService,
    private readonly tokens: TokensService,
  ) {}

  /** Phase 15 feedback widget. Public, rate-limited per IP. */
  @Public()
  @SkipAudit()
  @Post('feedback')
  @HttpCode(201)
  @ApiZodBody(feedbackSchema)
  async create(@CurrentUser() user: AuthUser | undefined, @ClientIp() ip: string, @ZBody(feedbackSchema) body: z.infer<typeof feedbackSchema>) {
    await this.rate.hit(`feedback:${this.tokens.ipHash(ip)}`, 5, 600);
    const [row] = await this.dbs.db.insert(feedback).values({ userId: user?.id ?? null, app: body.app, path: body.path ?? null, rating: body.rating ?? null, message: body.message }).returning({ id: feedback.id });
    return { ok: true, id: row!.id };
  }

  /**
   * Privacy-friendly analytics: no cookies, no user id, no raw IP. The session hash rotates daily
   * (ip + user agent + day + salt), so visitors cannot be tracked across days.
   */
  @Public()
  @SkipAudit()
  @Post('analytics/events')
  @HttpCode(204)
  @ApiZodBody(analyticsEventSchema)
  async event(@ClientIp() ip: string, @Req() req: AppRequest, @ZBody(analyticsEventSchema) body: z.infer<typeof analyticsEventSchema>) {
    const ipHash = this.tokens.ipHash(ip);
    await this.rate.hit(`analytics:${ipHash}`, 120, 60);
    const day = new Date().toISOString().slice(0, 10);
    const sessionHash = createHash('sha256').update(`${ipHash}:${String(req.headers['user-agent'] ?? '')}:${day}`).digest('hex').slice(0, 24);
    const path = body.path ? body.path.split('?')[0]!.slice(0, 300) : null; // drop query strings (may contain personal data)
    await this.dbs.db.insert(analyticsEvents).values({ name: body.name, path, sessionHash, props: body.props ?? null });
  }
}
