import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { V2Module } from '../v2/v2.module';
import { AdminContentController } from './content.controller';
import { ModerationController } from './moderation.controller';
import { AdminOpsController } from './ops.controller';
import { AdminUsersController, ImpersonationController } from './users.controller';

/** Phase 4 admin API (`/v1/admin/*`, moderator/admin roles, audited by the global interceptor). */
@Module({
  imports: [AuthModule, BillingModule, V2Module],
  controllers: [ModerationController, AdminUsersController, ImpersonationController, AdminContentController, AdminOpsController],
})
export class AdminModule {}
