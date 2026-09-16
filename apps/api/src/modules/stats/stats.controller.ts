import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { statsQuerySchema } from '@lokacia/contracts';
import { CurrentUser, Roles, SkipAudit } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ZQuery } from '../../common/zod';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('v1/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /** Role-aware account dashboard summary (`/account`). */
  @Get('account')
  account(@CurrentUser() user: AuthUser) {
    return this.stats.accountSummary(user);
  }

  /** Owner stats dashboard with district comparison and rule-based advice (P19, P18). */
  @Get('listings/:id')
  listing(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZQuery(statsQuerySchema) q: z.infer<typeof statsQuerySchema>) {
    return this.stats.listingDashboard(user, id, q.days);
  }

  /** Optional AI explanation of the advice (deterministic fallback without a key). */
  @Post('listings/:id/explain')
  @HttpCode(200)
  @SkipAudit()
  explain(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stats.explain(user, id);
  }

  @Roles('admin')
  @Post('aggregate')
  @HttpCode(200)
  @SkipAudit()
  async aggregate() {
    return { rows: await this.stats.aggregate() };
  }
}
