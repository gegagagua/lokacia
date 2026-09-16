import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { crmTaskSnoozeSchema, crmTasksQuerySchema, taskSchema } from '@lokacia/contracts';
import type { AppRequest } from '../../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { TasksService } from './tasks.service';

const countsQuery = z.object({ scope: z.enum(['mine', 'all']).default('mine') });
const pushSubscribe = z.object({ endpoint: z.string().url().optional(), keys: z.record(z.string(), z.string()).optional() }).passthrough();

/** C5 tasks & reminders. */
@ApiTags('crm')
@Controller('v1/crm')
@Crm()
export class CrmTasksController {
  /** Web push subscriptions (mock provider; kept in memory — real VAPID push is a HUMAN_TODO). */
  static readonly pushSubscriptions = new Map<string, unknown>();

  constructor(private readonly svc: TasksService) {}

  @Get('tasks')
  list(@Ctx() ctx: CrmCtx, @ZQuery(crmTasksQuerySchema) q: z.infer<typeof crmTasksQuerySchema>) {
    return this.svc.list(ctx, q);
  }

  @Get('tasks/counts')
  counts(@Ctx() ctx: CrmCtx, @ZQuery(countsQuery) q: z.infer<typeof countsQuery>) {
    return this.svc.counts(ctx, q.scope);
  }

  @Post('tasks')
  @ApiZodBody(taskSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(taskSchema) body: z.infer<typeof taskSchema>) {
    return this.svc.create(ctx, body);
  }

  @Patch('tasks/:id')
  @ApiZodBody(taskSchema.partial())
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(taskSchema.partial()) body: Partial<z.infer<typeof taskSchema>>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))) as typeof body;
    return this.svc.update(ctx, id, patch);
  }

  @Post('tasks/:id/complete')
  @HttpCode(200)
  complete(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.complete(ctx, id, true);
  }

  @Post('tasks/:id/reopen')
  @HttpCode(200)
  reopen(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.complete(ctx, id, false);
  }

  @Post('tasks/:id/snooze')
  @HttpCode(200)
  @ApiZodBody(crmTaskSnoozeSchema)
  snooze(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(crmTaskSnoozeSchema) body: z.infer<typeof crmTaskSnoozeSchema>) {
    return this.svc.snooze(ctx, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(200)
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.svc.remove(ctx, id);
  }

  @Post('push/subscribe')
  @HttpCode(200)
  subscribe(@Ctx() ctx: CrmCtx, @ZBody(pushSubscribe) body: z.infer<typeof pushSubscribe>) {
    CrmTasksController.pushSubscriptions.set(ctx.userId, body);
    return { ok: true, provider: 'mock' };
  }
}
