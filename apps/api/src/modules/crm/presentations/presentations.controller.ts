import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { presentationCreateSchema, presentationUpdateSchema } from '@lokacia/contracts';
import { Public, SkipAudit } from '../../../common/decorators';
import type { AppRequest } from '../../../common/request';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { PresentationsService } from './presentations.service';

function sendPdf(res: Response, buf: Buffer, name: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buf);
}

/** C10 public token endpoints (client opens the link; no login). Declared first so `public/*` never hits `:id`. */
@ApiTags('crm')
@Controller('v1/crm/presentations/public')
export class PresentationsPublicController {
  constructor(private readonly svc: PresentationsService) {}

  @Public()
  @Get(':token')
  view(@Param('token') token: string) {
    return this.svc.publicView(token);
  }

  @Public()
  @SkipAudit()
  @Post(':token/open')
  @HttpCode(200)
  open(@Param('token') token: string) {
    return this.svc.open(token);
  }

  @Public()
  @Get(':token/pdf')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    sendPdf(res, await this.svc.pdfByToken(token), 'lokacia-presentation');
  }
}

/** C10 branded presentations (org workspace). */
@ApiTags('crm')
@Controller('v1/crm/presentations')
@Crm()
export class PresentationsController {
  constructor(private readonly svc: PresentationsService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx, @Query('contactId') contactId?: string) {
    return this.svc.list(ctx, contactId && /^[0-9a-f-]{36}$/i.test(contactId) ? contactId : undefined);
  }

  @Post()
  @ApiZodBody(presentationCreateSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(presentationCreateSchema) body: z.infer<typeof presentationCreateSchema>) {
    return this.svc.create(ctx, body);
  }

  @Get(':id')
  get(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.get(ctx, id);
  }

  @Patch(':id')
  @ApiZodBody(presentationUpdateSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(presentationUpdateSchema) body: z.infer<typeof presentationUpdateSchema>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    return this.svc.update(ctx, id, Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))));
  }

  @Delete(':id')
  @HttpCode(200)
  @Crm('records.delete')
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.remove(ctx, id);
  }

  @Get(':id/pdf')
  async pdf(@Ctx() ctx: CrmCtx, @Param('id') id: string, @Res() res: Response) {
    sendPdf(res, await this.svc.pdfById(ctx, id), 'lokacia-presentation');
  }
}
