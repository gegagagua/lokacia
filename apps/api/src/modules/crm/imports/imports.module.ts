import { Module } from '@nestjs/common';
import { CrmImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/** CRM submodule: import / export (C24). */
@Module({ controllers: [CrmImportsController], providers: [ImportsService] })
export class CrmImportsModule {}
