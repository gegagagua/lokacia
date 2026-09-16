import { Module } from '@nestjs/common';
import { CrmAuditController } from './audit.controller';

/** CRM submodule: audit log viewer (C24). */
@Module({ controllers: [CrmAuditController] })
export class CrmAuditModule {}
