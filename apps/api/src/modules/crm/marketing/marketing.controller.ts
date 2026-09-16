import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { livenessAskSchema } from '@lokacia/contracts';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { CrmLivenessService } from './liveness.service';
import { OwnerReportsService } from './owner-reports.service';

/** C13 weekly owner reports. */
@ApiTags('crm')
@Controller('v1/crm/owner-reports')
@Crm()
export class OwnerReportsController {
  constructor(private readonly reports: OwnerReportsService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx) {
    return this.reports.list(ctx.orgId);
  }

  @Post('run')
  @HttpCode(200)
  @Crm('settings.manage')
  run(@Ctx() ctx: CrmCtx) {
    return this.reports.run(ctx.orgId);
  }

  @Get(':id')
  get(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.reports.get(ctx.orgId, id);
  }
}

/** C14 liveness automation for org listings. */
@ApiTags('crm')
@Controller('v1/crm/liveness')
@Crm()
export class CrmLivenessController {
  constructor(private readonly liveness: CrmLivenessService) {}

  @Get()
  dashboard(@Ctx() ctx: CrmCtx) {
    return this.liveness.dashboard(ctx.orgId);
  }

  @Post('ask')
  @HttpCode(200)
  @ApiZodBody(livenessAskSchema)
  ask(@Ctx() ctx: CrmCtx, @ZBody(livenessAskSchema) body: z.infer<typeof livenessAskSchema>) {
    return this.liveness.ask(ctx.orgId, body.listingIds, ctx.userId);
  }

  @Post(':listingId/confirm')
  @HttpCode(200)
  confirm(@Ctx() ctx: CrmCtx, @Param('listingId') listingId: string) {
    return this.liveness.confirm(ctx.orgId, listingId, ctx.userId);
  }
}
