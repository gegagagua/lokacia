import { Module } from '@nestjs/common';
import { CrmCalendarController, CrmViewingsController } from './calendar.controller';
import { ViewingsService } from './viewings.service';

/** CRM submodule: calendar (C4). */
@Module({ controllers: [CrmViewingsController, CrmCalendarController], providers: [ViewingsService], exports: [ViewingsService] })
export class CrmCalendarModule {}
