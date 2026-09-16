import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { savedSearchCreateSchema, savedSearchUpdateSchema, unsubscribeSchema } from '@lokacia/contracts';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AlertsService } from './alerts.service';

@ApiTags('saved-searches')
@Controller('v1/saved-searches')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.alerts.list(user);
  }

  @Post()
  @ApiZodBody(savedSearchCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(savedSearchCreateSchema) body: z.infer<typeof savedSearchCreateSchema>) {
    return this.alerts.create(user, body);
  }

  @Public()
  @Get('unsubscribe/:token')
  byToken(@Param('token') token: string) {
    return this.alerts.byToken(token);
  }

  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  @ApiZodBody(unsubscribeSchema)
  unsubscribe(@ZBody(unsubscribeSchema) body: z.infer<typeof unsubscribeSchema>) {
    return this.alerts.unsubscribe(body.token);
  }

  @Patch(':id')
  @ApiZodBody(savedSearchUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(savedSearchUpdateSchema) body: z.infer<typeof savedSearchUpdateSchema>) {
    return this.alerts.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alerts.remove(user, id);
  }
}
