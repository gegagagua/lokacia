import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';

/** C18 deal finance / commission calculator, C19 lead sources & ROI. */
@Module({ controllers: [FinanceController] })
export class CrmFinanceModule {}
