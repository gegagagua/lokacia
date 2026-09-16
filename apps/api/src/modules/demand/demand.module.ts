import { Module } from '@nestjs/common';
import { DemandController } from './demand.controller';
import { DemandService } from './demand.service';

/** Demand board (P6). */
@Module({ controllers: [DemandController], providers: [DemandService], exports: [DemandService] })
export class DemandModule {}
