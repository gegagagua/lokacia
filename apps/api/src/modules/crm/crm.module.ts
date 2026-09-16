import { Module } from '@nestjs/common';
import { CrmSharedModule } from './shared/crm-shared.module';
import { CrmContactsModule } from './contacts/contacts.module';
import { CrmDealsModule } from './deals/deals.module';
import { CrmTasksModule } from './tasks/tasks.module';
import { CrmCalendarModule } from './calendar/calendar.module';
import { CrmInboxModule } from './inbox/inbox.module';
import { CrmCallsModule } from './calls/calls.module';
import { CrmPortalModule } from './portal/portal.module';
import { CrmFeedsModule } from './feeds/feeds.module';
import { CrmPresentationsModule } from './presentations/presentations.module';
import { CrmMarketingModule } from './marketing/marketing.module';
import { CrmTeamModule } from './team/team.module';
import { CrmFinanceModule } from './finance/finance.module';
import { CrmAnalyticsModule } from './analytics/analytics.module';
import { CrmDocumentsModule } from './documents/documents.module';
import { CrmCobrokerModule } from './cobroker/cobroker.module';
import { CrmCompetitorsModule } from './competitors/competitors.module';
import { CrmSequencesModule } from './sequences/sequences.module';
import { CrmImportsModule } from './imports/imports.module';
import { CrmAuditModule } from './audit/audit.module';

/** Broker CRM (C1–C24). One submodule per feature area; shared services in ./shared. */
@Module({
  imports: [
    CrmSharedModule,
    CrmContactsModule,
    CrmDealsModule,
    CrmTasksModule,
    CrmCalendarModule,
    CrmInboxModule,
    CrmCallsModule,
    CrmPortalModule,
    CrmFeedsModule,
    CrmPresentationsModule,
    CrmMarketingModule,
    CrmTeamModule,
    CrmFinanceModule,
    CrmAnalyticsModule,
    CrmDocumentsModule,
    CrmCobrokerModule,
    CrmCompetitorsModule,
    CrmSequencesModule,
    CrmImportsModule,
    CrmAuditModule,
  ],
})
export class CrmModule {}
