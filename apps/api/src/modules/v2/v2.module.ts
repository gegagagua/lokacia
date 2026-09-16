import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ApiKeysController, PublicApiController } from './api-access/api-access.controller';
import { ApiKeyGuard } from './api-access/api-key.guard';
import { ApiKeysService } from './api-access/api-keys.service';
import { EscrowController } from './escrow/escrow.controller';
import { EscrowService } from './escrow/escrow.service';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { FxController, FxService } from './fx/fx.service';
import { InsightsController } from './insights/insights.controller';
import { InsightsService } from './insights/insights.service';
import { ScansService } from './insights/scans.service';
import { PropertyController } from './property/property.controller';
import { PropertyService } from './property/property.service';

/** v2.0: foot traffic & score (V1/V2), escrow (V3), rent & property (V4/V9), scans (V5), analytics API (V6), FX (V8), finance (V10). */
@Module({
  imports: [BillingModule],
  controllers: [InsightsController, EscrowController, PropertyController, ApiKeysController, PublicApiController, FxController, FinanceController],
  providers: [InsightsService, ScansService, EscrowService, PropertyService, ApiKeysService, ApiKeyGuard, FxService, FinanceService],
  exports: [InsightsService, ScansService, EscrowService, PropertyService, ApiKeysService, FxService, FinanceService],
})
export class V2Module {}
