import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CrmPermGuard } from './crm-access';
import { CrmEventsService } from './crm-events.service';
import { CrmSharedController } from './crm.controller';
import './templates';

/** Services every CRM submodule may inject: activities timeline, domain events, permission guard. */
@Global()
@Module({
  controllers: [CrmSharedController],
  providers: [ActivityService, CrmEventsService, CrmPermGuard],
  exports: [ActivityService, CrmEventsService, CrmPermGuard],
})
export class CrmSharedModule {}
