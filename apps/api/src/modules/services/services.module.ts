import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/** Services marketplace (P24). */
@Module({ controllers: [ServicesController], providers: [ServicesService], exports: [ServicesService] })
export class ServicesModule {}
