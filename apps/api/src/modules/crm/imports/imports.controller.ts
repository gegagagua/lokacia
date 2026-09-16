import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { EXPORT_ENTITIES, importCommitSchema, sheetsImportSchema, type ExportEntity } from '@lokacia/contracts';
import { problems } from '../../../common/problem';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { ImportsService } from './imports.service';

type UploadedSheet = { buffer: Buffer; originalname: string; size: number; mimetype: string };

/** C24: Excel / CSV / Google Sheets import with column mapping + full data export. */
@ApiTags('crm')
@Controller('v1/crm')
export class CrmImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('imports/preview')
  @Crm('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(@Ctx() ctx: CrmCtx, @UploadedFile() file: UploadedSheet) {
    return this.imports.preview(ctx, file);
  }

  @Post('imports/sheets')
  @Crm('data.import')
  @ApiZodBody(sheetsImportSchema)
  sheets(@Ctx() ctx: CrmCtx, @ZBody(sheetsImportSchema) body: z.infer<typeof sheetsImportSchema>) {
    return this.imports.previewSheets(ctx, body.url);
  }

  @Post('imports')
  @Crm('data.import')
  @ApiZodBody(importCommitSchema)
  commit(@Ctx() ctx: CrmCtx, @ZBody(importCommitSchema) body: z.infer<typeof importCommitSchema>) {
    return this.imports.commit(ctx, body);
  }

  @Get('imports')
  @Crm('data.import')
  history(@Ctx() ctx: CrmCtx) {
    return this.imports.history(ctx);
  }

  @Get('exports/:file')
  @Crm('data.export')
  async export(@Ctx() ctx: CrmCtx, @Param('file') file: string, @Res() res: Response) {
    const m = file.match(/^(\w+)\.(xlsx|csv)$/);
    if (!m || !(EXPORT_ENTITIES as readonly string[]).includes(m[1]!)) throw problems.notFound('ექსპორტი');
    const format = m[2] as 'xlsx' | 'csv';
    const buf = await this.imports.export(ctx, m[1] as ExportEntity, format);
    res.setHeader('content-type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('content-disposition', `attachment; filename="${m[1]}-${new Date().toISOString().slice(0, 10)}.${format}"`);
    res.send(buf);
  }
}
