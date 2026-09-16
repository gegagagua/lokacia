import { Module } from '@nestjs/common';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';

/** CRM submodule: competitors (C15 tracked URLs + price change log). */
@Module({ controllers: [CompetitorsController], providers: [CompetitorsService], exports: [CompetitorsService] })
export class CrmCompetitorsModule {}
