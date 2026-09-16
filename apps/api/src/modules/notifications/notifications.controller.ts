import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, SkipAudit } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('v1/notifications')
@SkipAudit()
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.svc.list(user.id);
    return { items, unread: items.filter((i) => !i.readAt).length };
  }

  @Post('read')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.svc.markRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.markRead(user.id, id);
  }
}
