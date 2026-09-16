import { Module } from '@nestjs/common';
import { PresentationsController, PresentationsPublicController } from './presentations.controller';
import { PresentationsService } from './presentations.service';

/** CRM submodule: presentations (C10 branded link/PDF with open tracking). */
@Module({ controllers: [PresentationsPublicController, PresentationsController], providers: [PresentationsService], exports: [PresentationsService] })
export class CrmPresentationsModule {}
