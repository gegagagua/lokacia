import { Module } from '@nestjs/common';
import { CrmInboxController, CrmInboxWebhooksController } from './inbox.controller';
import { InboxService } from './inbox.service';

/** CRM submodule: unified inbox (C6). */
@Module({ controllers: [CrmInboxWebhooksController, CrmInboxController], providers: [InboxService], exports: [InboxService] })
export class CrmInboxModule {}
