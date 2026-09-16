import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { kpiQuerySchema } from '@lokacia/contracts';
import { ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { AnalyticsService } from './analytics.service';

@ApiTags('crm-analytics')
@Controller('v1/crm/analytics')
@Crm()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('kpi')
  kpi(@Ctx() ctx: CrmCtx, @ZQuery(kpiQuerySchema) q: z.infer<typeof kpiQuerySchema>) {
    return this.analytics.kpi(ctx, q);
  }
}
