import { Module } from '@nestjs/common';
import { CrmCallsController } from './calls.controller';

@Module({ controllers: [CrmCallsController] })
export class CrmCallsModule {}
