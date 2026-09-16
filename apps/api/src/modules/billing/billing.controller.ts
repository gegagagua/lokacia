import { Controller, Get, Header, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { checkoutRequestSchema, mockPaymentCompleteSchema, reportPreviewQuerySchema } from '@lokacia/contracts';
import { CurrentUser, Public, SkipAudit } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { BillingService } from './billing.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { ReportsService } from './reports.service';

const uuid = z.string().uuid();

@ApiTags('billing')
@Controller('v1/billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly reports: ReportsService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Public()
  @Get('plans')
  @Header('cache-control', 'public, max-age=60')
  plans() {
    return this.billing.plansResponse();
  }

  @Post('checkout')
  @HttpCode(200)
  @ApiZodBody(checkoutRequestSchema)
  checkout(@CurrentUser() user: AuthUser, @ZBody(checkoutRequestSchema) body: z.infer<typeof checkoutRequestSchema>) {
    return this.billing.checkout(user, body);
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.billing.overview(user);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthUser) {
    return this.billing.invoicesFor(user);
  }

  @Get('invoices/:id')
  async invoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.invoiceDto(await this.billing.invoice(user, uuid.parse(id)));
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const inv = await this.billing.invoice(user, uuid.parse(id));
    const buf = await this.pdf.invoicePdf(inv);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="${inv.status === 'paid' ? 'receipt' : 'invoice'}-${inv.number}.pdf"`);
    res.send(buf);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.setCancel(user, uuid.parse(id), true);
  }

  @Post('subscriptions/:id/resume')
  @HttpCode(200)
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.setCancel(user, uuid.parse(id), false);
  }

  @Get('payments/:id')
  payment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.paymentSummary(user, uuid.parse(id));
  }

  @Post('payments/:id/mock-complete')
  @HttpCode(200)
  @ApiZodBody(mockPaymentCompleteSchema)
  mockComplete(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(mockPaymentCompleteSchema) body: z.infer<typeof mockPaymentCompleteSchema>) {
    return this.billing.mockComplete(user, uuid.parse(id), body.outcome);
  }

  @Public()
  @Get('reports/preview')
  preview(@ZQuery(reportPreviewQuerySchema) q: z.infer<typeof reportPreviewQuerySchema>) {
    return this.reports.preview(q.districtId, q.businessType);
  }

  @Get('reports')
  myReports(@CurrentUser() user: AuthUser) {
    return this.reports.mine(user.id);
  }

  @Get('reports/:id/pdf')
  async reportPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.reports.purchasePdf(user.id, user.role, uuid.parse(id));
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="lokacia-report-${id.slice(0, 8)}.pdf"`);
    res.send(buf);
  }
}

@ApiTags('payments')
@Controller('v1/payments')
export class PaymentsWebhookController {
  constructor(private readonly billing: BillingService) {}

  /** PSP webhook: HMAC signature over the raw body, deduplicated by provider event id. */
  @Public()
  @SkipAudit()
  @Post('webhooks/:provider')
  @HttpCode(200)
  webhook(@Param('provider') provider: string, @Req() req: AppRequest & { rawBody?: Buffer }) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    return this.billing.handleWebhook(provider, req.headers, raw);
  }
}
