import { Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { leaseCreateSchema, leaseMessageSchema, leaseUpdateSchema, maintenanceCreateSchema, maintenanceUpdateSchema, utilityReadingSchema } from '@lokacia/contracts';
import { CurrentUser, NoImpersonation, SkipAudit } from '../../../common/decorators';
import type { AppRequest, AuthUser } from '../../../common/request';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { PropertyService } from './property.service';

const uuid = z.string().uuid();

@ApiTags('property')
@Controller('v1/property')
export class PropertyController {
  constructor(private readonly property: PropertyService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.property.overview(user);
  }

  @Get('leases/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.property.detail(user, uuid.parse(id));
  }

  @Post('leases')
  @ApiZodBody(leaseCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(leaseCreateSchema) body: z.infer<typeof leaseCreateSchema>) {
    return this.property.create(user, body);
  }

  @Patch('leases/:id')
  @ApiZodBody(leaseUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: AppRequest, @ZBody(leaseUpdateSchema) body: z.infer<typeof leaseUpdateSchema>) {
    return this.property.update(user, uuid.parse(id), body, Object.keys((req.body as object) ?? {}));
  }

  @Post('rent-invoices/:id/pay')
  @NoImpersonation()
  @HttpCode(200)
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.property.pay(user, uuid.parse(id));
  }

  @Get('rent-invoices/:id/receipt.pdf')
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.property.receiptPdf(user, uuid.parse(id));
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="rent-${id.slice(0, 8)}.pdf"`);
    res.send(buf);
  }

  @Get('leases/:id/export')
  async export(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('format') format: string | undefined, @Res() res: Response) {
    const f = await this.property.export(user, uuid.parse(id), format === 'xlsx' ? 'xlsx' : 'csv');
    res.setHeader('content-type', f.contentType);
    res.setHeader('content-disposition', `attachment; filename="${f.filename}"`);
    res.send(f.buffer);
  }

  @Post('leases/:id/maintenance')
  @ApiZodBody(maintenanceCreateSchema)
  maintenance(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(maintenanceCreateSchema) body: z.infer<typeof maintenanceCreateSchema>) {
    return this.property.addMaintenance(user, uuid.parse(id), body);
  }

  @Patch('maintenance/:id')
  @ApiZodBody(maintenanceUpdateSchema)
  maintenanceStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(maintenanceUpdateSchema) body: z.infer<typeof maintenanceUpdateSchema>) {
    return this.property.updateMaintenance(user, uuid.parse(id), body.status);
  }

  @Post('leases/:id/utilities')
  @ApiZodBody(utilityReadingSchema)
  utility(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(utilityReadingSchema) body: z.infer<typeof utilityReadingSchema>) {
    return this.property.addUtility(user, uuid.parse(id), body);
  }

  @Post('leases/:id/messages')
  @SkipAudit()
  @ApiZodBody(leaseMessageSchema)
  message(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(leaseMessageSchema) body: z.infer<typeof leaseMessageSchema>) {
    return this.property.message(user, uuid.parse(id), body.body);
  }
}
