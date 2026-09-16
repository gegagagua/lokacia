import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { describeListing, type AiClient } from '@lokacia/ai';
import { describeFactsSchema, describeRequestSchema, type DescribeResponse } from '@lokacia/contracts';
import { CurrentUser, SkipAudit } from '../../common/decorators';
import { problems } from '../../common/problem';
import { RateLimitService } from '../../common/redis.service';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AI } from '../../integrations/integrations.module';
import { ListingsService } from '../listings/listings.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

@ApiTags('ai')
@Controller('v1/ai')
export class AiController {
  constructor(
    @Inject(AI) private readonly ai: AiClient,
    private readonly listings: ListingsService,
    private readonly tax: TaxonomyService,
    private readonly rate: RateLimitService,
  ) {}

  /** C11 text part: ka/en/ru listing descriptions from wizard facts or a saved listing; template fallback without a key. */
  @Post('describe')
  @HttpCode(200)
  @SkipAudit()
  @ApiZodBody(describeRequestSchema)
  async describe(@CurrentUser() user: AuthUser, @ZBody(describeRequestSchema) body: z.infer<typeof describeRequestSchema>): Promise<DescribeResponse> {
    await this.rate.hit(`ai:describe:${user.id}`, 30, 3600);
    let facts: z.infer<typeof describeFactsSchema>;
    if (body.listingId) {
      const l = await this.listings.getManageable(body.listingId, user);
      const d = await this.listings.read.detail(l);
      facts = describeFactsSchema.parse({ title: d.title, businessTypes: d.businessTypes, dealType: d.dealType, areaM2: d.areaM2, floor: d.floor, address: d.address, districtId: d.districtId, priceMinor: d.priceMinor, passport: d.passport, ...(body.facts ?? {}) });
    } else if (body.facts) facts = describeFactsSchema.parse(body.facts);
    else throw problems.badRequest('facts ან listingId სავალდებულოია');
    let districtId = facts.districtId ?? null;
    if (!districtId && facts.lat != null && facts.lng != null) districtId = await this.tax.districtAt(facts.lat, facts.lng);
    const district = await this.tax.districtById(districtId);
    const out = await describeListing(this.ai, {
      title: facts.title,
      businessTypes: facts.businessTypes,
      dealType: facts.dealType,
      areaM2: facts.areaM2,
      floor: facts.floor ?? null,
      address: facts.address,
      district: district?.nameKa ?? null,
      priceMinor: facts.priceMinor,
      passport: facts.passport,
    });
    return { ka: out.ka, en: out.en, ru: out.ru, source: out.source };
  }
}
