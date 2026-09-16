import { Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { reviewCreateSchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public, SkipAudit } from '../../common/decorators';
import { problems } from '../../common/problem';
import type { AuthUser } from '../../common/request';
import { TokensService } from '../../common/tokens.service';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { ProfilesService } from './profiles.service';
import { SeoService } from './seo.service';

@ApiTags('profiles')
@Controller('v1/profiles')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @Get('brokers')
  brokers(@Query('district') district?: string, @Query('q') q?: string) {
    return this.profiles.brokers({ district, q });
  }

  @Public()
  @Get('brokers/:slug')
  broker(@Param('slug') slug: string) {
    return this.profiles.broker(slug);
  }

  @Public()
  @Post('brokers/:slug/reveal-phone')
  @HttpCode(200)
  @SkipAudit()
  reveal(@Param('slug') slug: string, @ClientIp() ip: string, @CurrentUser() user?: AuthUser) {
    return this.profiles.revealBrokerPhone(slug, this.tokens.ipHash(ip), user);
  }

  @Post('brokers/:slug/reviews')
  @ApiZodBody(reviewCreateSchema)
  reviewBroker(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @ZBody(reviewCreateSchema) body: z.infer<typeof reviewCreateSchema>) {
    return this.profiles.review(user, 'broker', slug, body);
  }

  @Public()
  @Get('agencies/:slug')
  agency(@Param('slug') slug: string) {
    return this.profiles.agency(slug);
  }

  @Post('agencies/:slug/reviews')
  @ApiZodBody(reviewCreateSchema)
  reviewAgency(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @ZBody(reviewCreateSchema) body: z.infer<typeof reviewCreateSchema>) {
    return this.profiles.review(user, 'org', slug, body);
  }
}

const landingQuery = z.object({ businessType: z.string().max(40).optional(), district: z.string().max(60).optional(), city: z.string().max(40).optional() });
const sitemapQuery = z.object({ page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(50_000).default(10_000) });

@ApiTags('seo')
@Public()
@Controller('v1/seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('landing')
  @Header('cache-control', 'public, max-age=300')
  async landing(@ZQuery(landingQuery) q: z.infer<typeof landingQuery>) {
    const r = await this.seo.landing(q);
    if (!r) throw problems.notFound('გვერდი');
    return r;
  }

  @Get('combos')
  @Header('cache-control', 'public, max-age=900')
  combos(@Query('min') min?: string) {
    return this.seo.combos(Math.max(1, Number(min) || 1));
  }

  @Get('stats')
  @Header('cache-control', 'public, max-age=120')
  stats() {
    return this.seo.stats();
  }

  @Get('sitemap/listings')
  sitemap(@ZQuery(sitemapQuery) q: z.infer<typeof sitemapQuery>) {
    return this.seo.sitemapListings(q.page, q.size);
  }
}
