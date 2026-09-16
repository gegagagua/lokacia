import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { viewingBookSchema, viewingCancelSchema, viewingRescheduleSchema, viewingsQuerySchema } from '@lokacia/contracts';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { ViewingsService } from './viewings.service';

@ApiTags('viewings')
@Controller('v1/viewings')
export class ViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  @Post()
  @ApiZodBody(viewingBookSchema)
  book(@CurrentUser() user: AuthUser, @ZBody(viewingBookSchema) body: z.infer<typeof viewingBookSchema>) {
    return this.viewings.book(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @ZQuery(viewingsQuerySchema) q: z.infer<typeof viewingsQuerySchema>) {
    return this.viewings.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.viewings.getDto(user, id);
  }

  /** RFC 5545 invitation download. */
  @Get(':id/ics')
  async ics(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { filename, body } = await this.viewings.ics(user, id);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.viewings.confirm(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiZodBody(viewingCancelSchema)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(viewingCancelSchema) body: z.infer<typeof viewingCancelSchema>) {
    return this.viewings.cancel(user, id, body.reason ?? null);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  @ApiZodBody(viewingRescheduleSchema)
  reschedule(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(viewingRescheduleSchema) body: z.infer<typeof viewingRescheduleSchema>) {
    return this.viewings.reschedule(user, id, body.slotId);
  }

  @Post(':id/done')
  @HttpCode(200)
  done(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.viewings.markDone(user, id);
  }
}
