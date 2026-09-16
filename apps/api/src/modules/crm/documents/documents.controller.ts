import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { documentCreateSchema, documentSendSchema, documentSignSchema, documentVersionSchema } from '@lokacia/contracts';
import { ClientIp, Public, SkipAudit } from '../../../common/decorators';
import { RateLimitService } from '../../../common/redis.service';
import { TokensService } from '../../../common/tokens.service';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { DocumentsService } from './documents.service';

/** C21 documents: templates → versions → PDF → e-sign (mock adapter). */
@ApiTags('crm')
@Controller('v1/crm/documents')
export class CrmDocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly rate: RateLimitService,
    private readonly tokens: TokensService,
  ) {}

  @Get()
  @Crm()
  list(@Ctx() ctx: CrmCtx, @Query('dealId') dealId?: string, @Query('contactId') contactId?: string) {
    return this.docs.list(ctx, { dealId, contactId });
  }

  @Post()
  @Crm()
  @ApiZodBody(documentCreateSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(documentCreateSchema) body: z.infer<typeof documentCreateSchema>) {
    return this.docs.create(ctx, body);
  }

  /** Public e-sign page data (declared before `:id`). */
  @Public()
  @SkipAudit()
  @Get('sign/:ref')
  async signView(@Param('ref') ref: string, @ClientIp() ip: string) {
    await this.rate.hit(`crm-sign-view:${this.tokens.ipHash(ip)}`, 120, 3600);
    return this.docs.publicView(ref);
  }

  @Public()
  @Post('sign/:ref')
  @HttpCode(200)
  @ApiZodBody(documentSignSchema)
  async sign(@Param('ref') ref: string, @ZBody(documentSignSchema) body: z.infer<typeof documentSignSchema>, @ClientIp() ip: string) {
    await this.rate.hit(`crm-sign:${this.tokens.ipHash(ip)}`, 20, 3600);
    return this.docs.publicSign(ref, body);
  }

  @Get(':id')
  @Crm()
  get(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.docs.get(ctx, id);
  }

  @Post(':id/versions')
  @Crm()
  @ApiZodBody(documentVersionSchema)
  version(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(documentVersionSchema) body: z.infer<typeof documentVersionSchema>) {
    return this.docs.newVersion(ctx, id, body);
  }

  @Get(':id/pdf')
  @Crm()
  async pdf(@Ctx() ctx: CrmCtx, @Param('id') id: string, @Res() res: Response) {
    const { buf, fileName } = await this.docs.pdf(ctx, id);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="${fileName}"`);
    res.send(buf);
  }

  @Post(':id/send')
  @HttpCode(200)
  @Crm('documents.sign')
  @ApiZodBody(documentSendSchema)
  send(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(documentSendSchema) body: z.infer<typeof documentSendSchema>) {
    return this.docs.send(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @Crm('records.delete')
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.docs.remove(ctx, id);
  }
}
