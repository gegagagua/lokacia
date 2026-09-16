import { Module } from '@nestjs/common';
import { CrmSequencesController } from './sequences.controller';
import { SequencesService } from './sequences.service';

/** CRM submodule: follow-up sequences (C16). */
@Module({ controllers: [CrmSequencesController], providers: [SequencesService], exports: [SequencesService] })
export class CrmSequencesModule {}
