import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, Roles, SkipAudit } from '../../common/decorators';
import { LivenessService } from './liveness.service';

@ApiTags('liveness')
@Controller('v1/liveness')
export class LivenessController {
  constructor(private readonly liveness: LivenessService) {}

  /** Data for the one-tap confirm page (`/confirm/:listingId?token=`). */
  @Public()
  @Get('checks/:listingId')
  check(@Param('listingId') listingId: string, @Query('token') token: string) {
    return this.liveness.checkInfo(listingId, token ?? '');
  }

  /** Manual run of both scheduler steps (admin/demo). */
  @Roles('admin')
  @Post('run')
  @HttpCode(200)
  @SkipAudit()
  async run() {
    const sent = await this.liveness.sendDue();
    const hidden = await this.liveness.expireDue();
    return { sent, hidden };
  }
}
