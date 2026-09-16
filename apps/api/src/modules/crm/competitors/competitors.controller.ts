import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { competitorTrackSchema } from '@lokacia/contracts';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { CompetitorsService } from './competitors.service';

const updateSchema = competitorTrackSchema.partial().extend({ status: z.enum(['active', 'removed']).optional() });

/** C15 competitor monitoring. */
@ApiTags('crm')
@Controller('v1/crm/competitors')
@Crm()
export class CompetitorsController {
  constructor(private readonly svc: CompetitorsService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx, @Query('listingId') listingId?: string) {
    return this.svc.list(ctx, listingId && /^[0-9a-f-]{36}$/i.test(listingId) ? listingId : undefined);
  }

  @Post()
  @ApiZodBody(competitorTrackSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(competitorTrackSchema) body: z.infer<typeof competitorTrackSchema>) {
    return this.svc.create(ctx, body);
  }

  @Patch(':id')
  @ApiZodBody(updateSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(updateSchema) body: z.infer<typeof updateSchema>) {
    return this.svc.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @Crm('records.delete')
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.remove(ctx, id);
  }

  @Post(':id/check')
  @HttpCode(200)
  check(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.check(ctx, id);
  }

  @Get(':id/changes')
  changes(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.changes(ctx, id);
  }
}
