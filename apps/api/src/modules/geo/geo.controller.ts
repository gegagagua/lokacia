import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { DEAL_TYPES } from '@lokacia/contracts';
import { Public } from '../../common/decorators';
import { ZQuery } from '../../common/zod';
import { GeoService } from './geo.service';

const insightsQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  businessType: z.string().max(40).optional(),
  radiusM: z.coerce.number().min(100).max(3000).optional(),
  priceMinor: z.coerce.number().int().positive().optional(),
  areaM2: z.coerce.number().positive().optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
});
const priceQuery = z.object({
  districtId: z.string().uuid().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  areaM2: z.coerce.number().positive(),
  priceMinor: z.coerce.number().int().positive(),
  businessType: z.string().optional(),
  dealType: z.enum(DEAL_TYPES).optional(),
});
const statsQuery = z.object({ city: z.string().optional(), businessType: z.string().optional(), dealType: z.enum(DEAL_TYPES).optional() });

@ApiTags('geo')
@Public()
@Controller('v1/geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('insights')
  @Header('cache-control', 'public, max-age=300')
  insights(@ZQuery(insightsQuery) q: z.infer<typeof insightsQuery>) {
    return this.geo.insights(q);
  }

  @Get('price-check')
  priceCheck(@ZQuery(priceQuery) q: z.infer<typeof priceQuery>) {
    return this.geo.priceCheck(q);
  }

  @Get('districts/stats')
  @Header('cache-control', 'public, max-age=300')
  stats(@ZQuery(statsQuery) q: z.infer<typeof statsQuery>) {
    return this.geo.districtStats(q);
  }
}
