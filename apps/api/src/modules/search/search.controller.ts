import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { searchParseRequestSchema } from '@lokacia/contracts';
import { ClientIp, Public, SkipAudit } from '../../common/decorators';
import { RateLimitService } from '../../common/redis.service';
import { ApiZodBody, ZBody } from '../../common/zod';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('v1/search')
@SkipAudit()
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly rate: RateLimitService,
  ) {}

  @Public()
  @Post('parse')
  @HttpCode(200)
  @ApiZodBody(searchParseRequestSchema)
  async parse(@ZBody(searchParseRequestSchema) body: z.infer<typeof searchParseRequestSchema>, @ClientIp() ip: string) {
    await this.rate.hit(`parse:${ip}`, 60, 60);
    return this.search.parse(body.text);
  }
}
