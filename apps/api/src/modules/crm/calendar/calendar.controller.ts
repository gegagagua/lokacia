import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { crmRouteApplySchema, crmRouteQuerySchema, crmViewingCreateSchema, crmViewingsQuerySchema, crmViewingUpdateSchema } from '@lokacia/contracts';
import { Public, SkipAudit } from '../../../common/decorators';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { ViewingsService } from './viewings.service';

/** C4 viewing calendar: CRUD, Google Calendar (adapter) sync, day route optimization. */
@ApiTags('crm')
@Controller('v1/crm/viewings')
@Crm()
export class CrmViewingsController {
  constructor(private readonly svc: ViewingsService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx, @ZQuery(crmViewingsQuerySchema) q: z.infer<typeof crmViewingsQuerySchema>) {
    return this.svc.list(ctx, q);
  }

  @Get('route')
  route(@Ctx() ctx: CrmCtx, @ZQuery(crmRouteQuerySchema) q: z.infer<typeof crmRouteQuerySchema>) {
    return this.svc.route(ctx, q);
  }

  @Post('route/apply')
  @HttpCode(200)
  @ApiZodBody(crmRouteApplySchema)
  apply(@Ctx() ctx: CrmCtx, @ZBody(crmRouteApplySchema) body: z.infer<typeof crmRouteApplySchema>) {
    return this.svc.applyRoute(ctx, body);
  }

  @Get(':id')
  get(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.get(ctx, id);
  }

  @Post()
  @ApiZodBody(crmViewingCreateSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(crmViewingCreateSchema) body: z.infer<typeof crmViewingCreateSchema>) {
    return this.svc.create(ctx, body);
  }

  @Patch(':id')
  @ApiZodBody(crmViewingUpdateSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(crmViewingUpdateSchema) body: z.infer<typeof crmViewingUpdateSchema>) {
    return this.svc.update(ctx, id, body);
  }

  @Post(':id/sync')
  @HttpCode(200)
  sync(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.sync(ctx, id);
  }

  @Delete(':id')
  @HttpCode(200)
  cancel(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.cancel(ctx, id);
  }
}

@ApiTags('crm')
@Controller('v1/crm/calendar')
export class CrmCalendarController {
  constructor(private readonly svc: ViewingsService) {}

  @Get('feed-url')
  @Crm()
  feedUrl(@Ctx() ctx: CrmCtx) {
    return this.svc.feedUrl(ctx);
  }

  @Get('google')
  @Crm()
  google(@Ctx() ctx: CrmCtx) {
    return this.svc.googleStatus(ctx);
  }

  @Post('google/connect')
  @HttpCode(200)
  @Crm()
  connect(@Ctx() ctx: CrmCtx) {
    return this.svc.googleConnect(ctx);
  }

  @Post('google/disconnect')
  @HttpCode(200)
  @Crm()
  disconnect(@Ctx() ctx: CrmCtx) {
    return this.svc.googleDisconnect(ctx);
  }

  /** Per-agent subscription feed (secret token in the URL). */
  @Public()
  @SkipAudit()
  @Get(':file')
  async ics(@Param('file') file: string, @Res() res: Response) {
    const token = file.replace(/\.ics$/, '');
    const body = await this.svc.feed(token);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('cache-control', 'private, max-age=300');
    res.send(body);
  }
}
