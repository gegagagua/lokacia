import { Module } from '@nestjs/common';
import { DealsController, PipelinesController } from './deals.controller';
import { DealsService } from './deals.service';
import { PipelineService } from './pipeline.service';

/** C3 deal kanban with configurable pipeline stages. */
@Module({ controllers: [PipelinesController, DealsController], providers: [PipelineService, DealsService], exports: [PipelineService, DealsService] })
export class CrmDealsModule {}
