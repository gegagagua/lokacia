import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { sequenceEnrollSchema, sequenceSchema } from '@lokacia/contracts';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { SequencesService } from './sequences.service';

const patchSchema = sequenceSchema.partial();

/** C16 automated follow-up sequences. */
@ApiTags('crm')
@Controller('v1/crm/sequences')
@Crm()
export class CrmSequencesController {
  constructor(private readonly svc: SequencesService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx) {
    return this.svc.list(ctx);
  }

  @Get('runs')
  runs(@Ctx() ctx: CrmCtx, @Query('sequenceId') sequenceId?: string, @Query('contactId') contactId?: string, @Query('status') status?: string) {
    return this.svc.runs(ctx, { sequenceId, contactId, status });
  }

  @Post('runs/:id/stop')
  @HttpCode(200)
  stop(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.stopRun(ctx, id);
  }

  @Post()
  @Crm('sequences.manage')
  @ApiZodBody(sequenceSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(sequenceSchema) body: z.infer<typeof sequenceSchema>) {
    return this.svc.create(ctx, body);
  }

  @Patch(':id')
  @Crm('sequences.manage')
  @ApiZodBody(patchSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(z.object({}).passthrough()) raw: Record<string, unknown>) {
    const parsed = patchSchema.parse(raw);
    const patch = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw));
    return this.svc.update(ctx, id, patch);
  }

  @Delete(':id')
  @Crm('sequences.manage')
  @HttpCode(200)
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.remove(ctx, id);
  }

  @Post(':id/enroll')
  @ApiZodBody(sequenceEnrollSchema)
  enroll(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(sequenceEnrollSchema) body: z.infer<typeof sequenceEnrollSchema>) {
    return this.svc.enroll(ctx, id, body.contactId, body.dealId ?? null);
  }
}
