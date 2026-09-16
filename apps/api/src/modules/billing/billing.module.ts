import { Module } from '@nestjs/common';
import { BillingController, PaymentsWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { ReportsService } from './reports.service';

/** Phase 13: plans, checkout, PSP webhooks, invoices/receipts, subscriptions lifecycle, paid reports (P23). */
@Module({
  controllers: [BillingController, PaymentsWebhookController],
  providers: [BillingService, ReportsService, InvoicePdfService],
  exports: [BillingService, ReportsService, InvoicePdfService],
})
export class BillingModule {}
