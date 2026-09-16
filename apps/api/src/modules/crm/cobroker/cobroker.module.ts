import { Module } from '@nestjs/common';
import { CrmCobrokerController } from './cobroker.controller';

/** CRM submodule: co-brokering (C22). */
@Module({ controllers: [CrmCobrokerController] })
export class CrmCobrokerModule {}
