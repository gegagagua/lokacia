import { Module } from '@nestjs/common';
import { CrmDocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/** CRM submodule: documents & e-sign (C21). */
@Module({ controllers: [CrmDocumentsController], providers: [DocumentsService], exports: [DocumentsService] })
export class CrmDocumentsModule {}
