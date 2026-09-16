import { Module } from '@nestjs/common';
import { CrmContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { MatchingService } from './matching.service';

/** C1 contacts & dedup merge, C2 requirement matching. */
@Module({ controllers: [CrmContactsController], providers: [ContactsService, MatchingService], exports: [ContactsService, MatchingService] })
export class CrmContactsModule {}
