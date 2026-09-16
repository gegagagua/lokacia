import { Controller, Get, Header, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { scanCreateSchema } from '@lokacia/contracts';
import { CurrentUser, Public, SkipAudit } from '../../../common/decorators';
import { problems } from '../../../common/problem';
import type { AuthUser } from '../../../common/request';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { ListingReadService } from '../../listings/listing-read.service';
import { DEMO_OUTLINE, roomGlb } from './glb';
import { InsightsService } from './insights.service';
import { ScansService } from './scans.service';

let demoGlb: Buffer | null = null;

@ApiTags('v2')
@Controller('v1/v2')
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly scans: ScansService,
    private readonly read: ListingReadService,
  ) {}

  @Public()
  @Get('listings/:id/traffic')
  @Header('cache-control', 'public, max-age=300')
  traffic(@Param('id') id: string) {
    return this.insights.trafficFor(id);
  }

  @Public()
  @Get('listings/:id/score')
  @Header('cache-control', 'public, max-age=300')
  score(@Param('id') id: string, @Query('businessType') businessType?: string) {
    return this.insights.scoreFor(id, businessType || undefined);
  }

  @Post('listings/:id/score/recompute')
  @HttpCode(200)
  @SkipAudit()
  async recompute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('businessType') businessType?: string) {
    const l = await this.insights.listing(id);
    if (!(await this.read.canManage(l, user))) throw problems.forbidden();
    return this.insights.recompute(l.id, businessType || undefined);
  }

  @Public()
  @Get('listings/:id/scans')
  scansList(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Query('all') all?: string) {
    return this.scans.list(id, all === 'true' && !!user);
  }

  @Post('listings/:id/scans')
  @ApiZodBody(scanCreateSchema)
  createScan(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(scanCreateSchema) body: z.infer<typeof scanCreateSchema>) {
    return this.scans.create(user, id, body);
  }

  /** Demo LiDAR capture (seeded scan) generated from the plan outline. */
  @Public()
  @Get('scans/demo/room.glb')
  demo(@Res() res: Response) {
    demoGlb ??= roomGlb(DEMO_OUTLINE);
    res.setHeader('content-type', 'model/gltf-binary');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.send(demoGlb);
  }
}
