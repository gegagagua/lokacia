import { Controller, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { financeApplicationSchema } from '@lokacia/contracts';
import { CurrentUser, Public, SkipAudit } from '../../../common/decorators';
import type { AppRequest, AuthUser } from '../../../common/request';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller('v1/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Public()
  @Get('products')
  @Header('cache-control', 'public, max-age=120')
  products() {
    return this.finance.products();
  }

  @Post('applications')
  @ApiZodBody(financeApplicationSchema)
  apply(@CurrentUser() user: AuthUser, @ZBody(financeApplicationSchema) body: z.infer<typeof financeApplicationSchema>) {
    return this.finance.apply(user, body);
  }

  @Get('applications')
  mine(@CurrentUser() user: AuthUser) {
    return this.finance.mine(user);
  }

  @Public()
  @SkipAudit()
  @Post('webhooks/:partner')
  @HttpCode(200)
  webhook(@Param('partner') partner: string, @Req() req: AppRequest & { rawBody?: Buffer }) {
    return this.finance.webhook(partner, req.headers, req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {}));
  }
}
