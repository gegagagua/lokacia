import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { problems } from '../../common/problem';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('taxonomy')
@Public()
@Controller('v1/taxonomy')
export class TaxonomyController {
  constructor(private readonly tax: TaxonomyService) {}

  @Get('business-types')
  @Header('cache-control', 'public, max-age=60')
  businessTypes() {
    return this.tax.businessTypes();
  }

  @Get('business-types/:slug')
  async businessType(@Param('slug') slug: string) {
    const t = await this.tax.businessType(slug);
    if (!t) throw problems.notFound('ბიზნესის ტიპი');
    return t;
  }

  @Get('districts')
  @Header('cache-control', 'public, max-age=60')
  districts(@Query('city') city?: string) {
    return this.tax.districts(city);
  }

  @Get('districts.geojson')
  @Header('cache-control', 'public, max-age=300')
  geojson(@Query('city') city?: string) {
    return this.tax.districtGeojson(city ?? 'tbilisi');
  }

  @Get('permits/:slug')
  async permits(@Param('slug') slug: string) {
    const p = await this.tax.permits(slug);
    if (!p) throw problems.notFound('ჩეკლისტი');
    return p;
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const p = await this.tax.page(slug);
    if (!p) throw problems.notFound('გვერდი');
    return p;
  }
}
