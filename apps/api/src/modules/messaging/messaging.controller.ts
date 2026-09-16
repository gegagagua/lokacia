import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { conversationStartSchema, conversationWithUserSchema, messageSendSchema, messagesQuerySchema } from '@lokacia/contracts';
import { CurrentUser, SkipAudit } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@Controller('v1/conversations')
export class MessagingController {
  constructor(private readonly chat: MessagingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chat.list(user);
  }

  @Get('unread')
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.chat.unreadCount(user.id) };
  }

  /** Start (or continue) a conversation about a listing with its contact person. */
  @Post()
  @ApiZodBody(conversationStartSchema)
  start(@CurrentUser() user: AuthUser, @ZBody(conversationStartSchema) body: z.infer<typeof conversationStartSchema>) {
    return this.chat.startAboutListing(user, body.listingId, body.body);
  }

  /** Start a direct conversation with a known counterpart (offer/viewing participant). */
  @Post('with-user')
  @ApiZodBody(conversationWithUserSchema)
  withUser(@CurrentUser() user: AuthUser, @ZBody(conversationWithUserSchema) body: z.infer<typeof conversationWithUserSchema>) {
    return this.chat.startWithCounterpart(user, body.userId, body.body, body.listingId ?? null);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.get(user, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZQuery(messagesQuerySchema) q: z.infer<typeof messagesQuerySchema>) {
    return this.chat.messages(user, id, q.cursor, q.limit);
  }

  @Post(':id/messages')
  @ApiZodBody(messageSendSchema)
  @SkipAudit()
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(messageSendSchema) body: z.infer<typeof messageSendSchema>) {
    return this.chat.send(user, id, body.body, body.attachments ?? []);
  }

  @Post(':id/read')
  @HttpCode(200)
  @SkipAudit()
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.markRead(user, id);
  }
}
