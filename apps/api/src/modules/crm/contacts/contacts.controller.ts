import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { contactListQuerySchema, contactMergeSchema, contactSchema, matchStatusSchema, portalSendSchema, type ContactInput } from '@lokacia/contracts';
import type { AppRequest } from '../../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';
import { ContactsService } from './contacts.service';
import { MatchingService } from './matching.service';

const contactPatchSchema = contactSchema.partial();

/** C1 contact base + C2 matches + portal hand-off. Agents only see their own contacts (C17). */
@ApiTags('crm-contacts')
@Controller('v1/crm/contacts')
@Crm()
export class CrmContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly matching: MatchingService,
  ) {}

  @Get()
  list(@Ctx() ctx: CrmCtx, @ZQuery(contactListQuerySchema) q: z.infer<typeof contactListQuerySchema>) {
    return this.contacts.list(ctx, q);
  }

  @Get('facets')
  facets(@Ctx() ctx: CrmCtx) {
    return this.contacts.facets(ctx);
  }

  @Get('duplicates')
  duplicates(@Ctx() ctx: CrmCtx) {
    return this.contacts.duplicates(ctx);
  }

  @Post('merge')
  @HttpCode(200)
  @ApiZodBody(contactMergeSchema)
  merge(@Ctx() ctx: CrmCtx, @ZBody(contactMergeSchema) body: z.infer<typeof contactMergeSchema>) {
    return this.contacts.merge(ctx, body.targetId, body.sourceIds);
  }

  @Post()
  @ApiZodBody(contactSchema)
  create(@Ctx() ctx: CrmCtx, @ZBody(contactSchema) body: ContactInput) {
    return this.contacts.create(ctx, body);
  }

  @Get(':id')
  detail(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.contacts.detail(ctx, id);
  }

  @Patch(':id')
  @ApiZodBody(contactPatchSchema)
  update(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(contactPatchSchema) body: Partial<ContactInput>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))) as Partial<ContactInput>;
    return this.contacts.update(ctx, id, patch);
  }

  @Delete(':id')
  @HttpCode(200)
  @Crm('records.delete')
  remove(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.contacts.remove(ctx, id);
  }

  @Get(':id/matches')
  matches(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    return this.matching.list(ctx, id);
  }

  @Post(':id/matches/refresh')
  @HttpCode(200)
  async refresh(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    await this.contacts.getRaw(ctx, id);
    return this.matching.matchContact(ctx.orgId, id);
  }

  @Patch(':id/matches/:matchId')
  @ApiZodBody(matchStatusSchema)
  setMatch(@Ctx() ctx: CrmCtx, @Param('id') id: string, @Param('matchId') matchId: string, @ZBody(matchStatusSchema) body: z.infer<typeof matchStatusSchema>) {
    return this.matching.setStatus(ctx, id, matchId, body.status);
  }

  @Post(':id/portal/send')
  @HttpCode(200)
  @ApiZodBody(portalSendSchema)
  send(@Ctx() ctx: CrmCtx, @Param('id') id: string, @ZBody(portalSendSchema) body: z.infer<typeof portalSendSchema>) {
    return this.matching.sendToPortal(ctx, id, body.matchIds);
  }

  @Post(':id/portal/token')
  @HttpCode(200)
  async token(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    const token = await this.contacts.ensurePortalToken(ctx, id);
    return { token, url: this.contacts.portalUrl(token) };
  }

  @Post(':id/portal/rotate')
  @HttpCode(200)
  async rotate(@Ctx() ctx: CrmCtx, @Param('id') id: string) {
    const token = await this.contacts.rotatePortalToken(ctx, id);
    return { token, url: this.contacts.portalUrl(token) };
  }
}
