import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { inboxLinkSchema, inboxReplySchema, inboxSimulateSchema, inboxWebhookSchema } from '@lokacia/contracts';
import { Public, SkipAudit } from '../../../common/decorators';
import { problems } from '../../../common/problem';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { ENV, type Env } from '../../../config/env';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { InboxService } from './inbox.service';

/** C6 unified inbox for the org. */
@ApiTags('crm')
@Controller('v1/crm/inbox')
@Crm()
export class CrmInboxController {
  constructor(private readonly svc: InboxService) {}

  @Get()
  list(@Ctx() ctx: CrmCtx, @Query('q') q?: string, @Query('channel') channel?: string) {
    return this.svc.list(ctx, { q, channel });
  }

  @Get(':id')
  get(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.get(ctx, id);
  }

  @Get(':id/messages')
  @SkipAudit()
  messages(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.messages(ctx, id);
  }

  @Post(':id/messages')
  @ApiZodBody(inboxReplySchema)
  reply(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(inboxReplySchema) body: z.infer<typeof inboxReplySchema>) {
    return this.svc.reply(ctx, id, body.body);
  }

  @Post(':id/link')
  @HttpCode(200)
  @ApiZodBody(inboxLinkSchema)
  link(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(inboxLinkSchema) body: z.infer<typeof inboxLinkSchema>) {
    return this.svc.link(ctx, id, body.contactId);
  }

  /** Dev/demo helper: simulate an inbound WhatsApp/Viber/Telegram message for the selected org. */
  @Post('simulate')
  @ApiZodBody(inboxSimulateSchema)
  simulate(@Ctx() ctx: CrmCtx, @ZBody(inboxSimulateSchema) body: z.infer<typeof inboxSimulateSchema>) {
    return this.svc.inbound(ctx.orgId, body.channel, body);
  }
}

/** Channel webhooks (mock adapters). Real providers need signature verification — see HUMAN_TODO. */
@ApiTags('crm')
@Controller('v1/crm/inbox/webhooks')
export class CrmInboxWebhooksController {
  constructor(
    private readonly svc: InboxService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @SkipAudit()
  @Post(':channel')
  @HttpCode(200)
  @ApiZodBody(inboxWebhookSchema)
  webhook(@Param('channel') channel: string, @Headers('x-lk-webhook') secret: string | undefined, @ZBody(inboxWebhookSchema) body: z.infer<typeof inboxWebhookSchema>) {
    if (!['whatsapp', 'viber', 'telegram'].includes(channel)) throw problems.notFound('არხი');
    const expected = this.env.NODE_ENV === 'production' ? this.env.PAYMENTS_WEBHOOK_SECRET : 'dev';
    if (secret !== expected) throw problems.forbidden('webhook secret');
    return this.svc.inbound(body.orgId, channel as 'whatsapp' | 'viber' | 'telegram', body);
  }
}
