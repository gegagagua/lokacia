import { Module } from '@nestjs/common';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

/** CRM submodule: feeds (C9 XML export). */
@Module({ controllers: [FeedsController], providers: [FeedsService], exports: [FeedsService] })
export class CrmFeedsModule {}
