import { Global, Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';

@Global()
@Module({ controllers: [TaxonomyController], providers: [TaxonomyService], exports: [TaxonomyService] })
export class TaxonomyModule {}
