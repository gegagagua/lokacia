import { Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AppRequest } from '../../common/request';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  listingInputSchema, listingStatusChangeSchema, listingUpdateSchema, searchQuerySchema, slotsCreateSchema, type SearchQuery,
} from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public, SkipAudit } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { problems } from '../../common/problem';
import { SearchService } from '../search/search.service';
import { ListingsService } from './listings.service';

const createBody = listingInputSchema.extend({ submit: z.boolean().default(false) });
const confirmBody = z.object({ token: z.string().min(10), answer: z.enum(['available', 'rented']).default('available') });
const verificationBody = z.object({ documentUrl: z.string().min(5) });

@ApiTags('listings')
@Controller('v1/listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly search: SearchService,
  ) {}

  @Public()
  @Get()
  find(@ZQuery(searchQuerySchema) q: SearchQuery) {
    return this.search.search(q);
  }

  @Public()
  @Get('map')
  map(@ZQuery(searchQuerySchema) q: SearchQuery) {
    return this.search.map(q);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Headers('x-org-id') orgId?: string, @Query('status') status?: string) {
    return this.listings.mine(user, { orgId, status });
  }

  @Public()
  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined, @ClientIp() ip: string, @Query('track') track?: string) {
    const d = await this.listings.detail(id, user);
    if (track !== '0' && d.status === 'active' && !d.canManage) void this.listings.trackView(d.id, ip, user);
    return d;
  }

  @Public()
  @Get(':id/similar')
  async similar(@Param('id') id: string) {
    const l = await this.listings.read.findRaw(id);
    if (!l) throw problems.notFound('განცხადება');
    return this.listings.similar(l);
  }

  @Post()
  @ApiZodBody(createBody)
  create(@CurrentUser() user: AuthUser, @ZBody(createBody) body: z.infer<typeof createBody>, @Headers('x-org-id') orgId?: string) {
    const { submit, ...input } = body;
    return this.listings.create(user, input, { orgId, submit });
  }

  @Patch(':id')
  @ApiZodBody(listingUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(listingUpdateSchema) body: z.infer<typeof listingUpdateSchema>, @Req() req: AppRequest) {
    // Partial schemas still apply `.default()`s; keep only keys the client actually sent.
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))) as typeof body;
    return this.listings.update(user, id, patch);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiZodBody(listingStatusChangeSchema)
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(listingStatusChangeSchema) body: z.infer<typeof listingStatusChangeSchema>) {
    return this.listings.changeStatus(user, id, body.status, body.reason);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listings.remove(user, id);
  }

  @Public()
  @Post(':id/reveal-phone')
  @HttpCode(200)
  @SkipAudit()
  reveal(@Param('id') id: string, @ClientIp() ip: string, @CurrentUser() user?: AuthUser) {
    return this.listings.revealPhone(id, ip, user);
  }

  @Public()
  @Post(':id/share')
  @HttpCode(200)
  @SkipAudit()
  async share(@Param('id') id: string, @ClientIp() ip: string, @CurrentUser() user?: AuthUser) {
    const l = await this.listings.read.findRaw(id);
    if (!l) throw problems.notFound('განცხადება');
    return this.listings.trackShare(l.id, ip, user);
  }

  @Public()
  @Post(':id/confirm')
  @HttpCode(200)
  @ApiZodBody(confirmBody)
  confirm(@Param('id') id: string, @ZBody(confirmBody) body: z.infer<typeof confirmBody>) {
    return this.listings.confirmLiveness(id, body.token, body.answer);
  }

  @Post(':id/confirm-owner')
  @HttpCode(200)
  confirmOwner(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listings.confirmByOwner(user, id);
  }

  @Post(':id/verification')
  @ApiZodBody(verificationBody)
  verification(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(verificationBody) body: z.infer<typeof verificationBody>) {
    return this.listings.requestVerification(user, id, body.documentUrl);
  }

  @Get(':id/verification')
  async verificationStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const l = await this.listings.getManageable(id, user);
    return this.listings.verifications(l.id);
  }

  @Public()
  @Get(':id/slots')
  async slots(@Param('id') id: string, @Query('kind') kind?: 'viewing' | 'short_term') {
    const l = await this.listings.read.findRaw(id);
    if (!l) throw problems.notFound('განცხადება');
    return this.listings.slots(l.id, kind);
  }

  @Post(':id/slots')
  @ApiZodBody(slotsCreateSchema)
  addSlots(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(slotsCreateSchema) body: z.infer<typeof slotsCreateSchema>) {
    return this.listings.addSlots(user, id, body.kind, body.slots);
  }

  @Delete(':id/slots/:slotId')
  @HttpCode(200)
  deleteSlot(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('slotId') slotId: string) {
    return this.listings.deleteSlot(user, id, slotId);
  }
}
