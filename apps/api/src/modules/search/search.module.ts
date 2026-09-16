import { Global, Module } from '@nestjs/common';
import { ListingReadService } from '../listings/listing-read.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Global()
@Module({ controllers: [SearchController], providers: [SearchService, ListingReadService], exports: [SearchService, ListingReadService] })
export class SearchModule {}
