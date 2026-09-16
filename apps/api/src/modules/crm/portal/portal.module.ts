import { Module } from '@nestjs/common';
import { CrmPortalController } from './portal.controller';

/** C8 client portal (public tokenized link). */
@Module({ controllers: [CrmPortalController] })
export class CrmPortalModule {}
