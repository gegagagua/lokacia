import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { dealBoardQuerySchema, dealMoveSchema, dealSchema, pipelineUpdateSchema } from '@lokacia/contracts';
import type { AppRequest } from '../../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { dealPatchSchema, DealsService } from './deals.service';
import { PipelineService } from './pipeline.service';

@ApiTags('crm-deals')
@Controller('v1/crm/pipelines')
@Crm()
export class PipelinesController {
  constructor(private readonly pipelines: PipelineService) {}

  @Get('default')
  get(@Ctx() ctx: CrmCtx) {
    return this.pipelines.withCounts(ctx.orgId);
  }

  @Put('default')
  @Crm('pipeline.manage')
  @ApiZodBody(pipelineUpdateSchema)
  update(@Ctx() ctx: CrmCtx, @ZBody(pipelineUpdateSchema) body: z.infer<typeof pipelineUpdateSchema>) {
    return this.pipelines.update(ctx.orgId, body);
  }
}

@ApiTags('crm-deals')
@Controller('v1/crm/deals')
@Crm()
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  board(@Ctx() ctx: CrmCtx, @ZQuery(dealBoardQuerySchema) q: z.infer<typeof dealBoardQuerySchema>) {
    return this.deals.board(ctx, q);
  }

  @Post()
  @ApiZodBody(dealSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(dealSchema) body: z.infer<typeof dealSchema>) {
    return this.deals.create(ctx, body);
  }

  @Get(':id')
  detail(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.deals.detail(ctx, id);
  }

  @Patch(':id')
  @ApiZodBody(dealPatchSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(dealPatchSchema) body: z.infer<typeof dealPatchSchema>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))) as typeof body;
    return this.deals.update(ctx, id, patch);
  }

  @Post(':id/move')
  @HttpCode(200)
  @ApiZodBody(dealMoveSchema)
  move(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(dealMoveSchema) body: z.infer<typeof dealMoveSchema>) {
    return this.deals.move(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @Crm('records.delete')
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.deals.remove(ctx, id);
  }
}
