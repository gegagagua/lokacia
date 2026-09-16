import { Module } from '@nestjs/common';
import { CrmListingsController } from './crm-listings.controller';
import { CrmLivenessService } from './liveness.service';
import { CrmLivenessController, OwnerReportsController } from './marketing.controller';
import { OwnerReportsService } from './owner-reports.service';
import { CrmProfileController } from './profile.controller';

/** CRM submodule: marketing — org listings workspace (C9), broker profile (C12), owner reports (C13), liveness automation (C14). AI descriptions use POST /v1/ai/describe (C11). */
@Module({
  controllers: [CrmListingsController, CrmProfileController, OwnerReportsController, CrmLivenessController],
  providers: [OwnerReportsService, CrmLivenessService],
  exports: [OwnerReportsService, CrmLivenessService],
})
export class CrmMarketingModule {}
