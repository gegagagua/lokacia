import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { prebookSchema } from '@lokacia/contracts';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('v1/projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Public()
  @Get()
  list(@Query('city') city?: string, @Query('org') org?: string) {
    return this.svc.list({ city, org });
  }

  @Get('prebookings/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.myPrebookings(user);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.svc.detail(slug);
  }

  @Post(':slug/prebook')
  @ApiZodBody(prebookSchema)
  prebook(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @ZBody(prebookSchema) body: z.infer<typeof prebookSchema>) {
    return this.svc.prebook(user, { ...body, projectSlug: slug });
  }
}

/** Pre-booking straight from a unit's listing page (P8). */
@ApiTags('projects')
@Controller('v1/listings')
export class ListingPrebookController {
  constructor(private readonly svc: ProjectsService) {}

  @Post(':id/prebook')
  @ApiZodBody(prebookSchema)
  prebook(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(prebookSchema) body: z.infer<typeof prebookSchema>) {
    return this.svc.prebook(user, { ...body, listingId: id });
  }
}
