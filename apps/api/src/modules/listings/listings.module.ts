import { Global, Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Global()
@Module({ controllers: [ListingsController], providers: [ListingsService], exports: [ListingsService] })
export class ListingsModule {}
