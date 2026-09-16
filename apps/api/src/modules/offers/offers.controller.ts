import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { offerCounterSchema, offerCreateSchema, offerRejectSchema, offersQuerySchema } from '@lokacia/contracts';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller('v1/offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post()
  @ApiZodBody(offerCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(offerCreateSchema) body: z.infer<typeof offerCreateSchema>) {
    return this.offers.create(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @ZQuery(offersQuerySchema) q: z.infer<typeof offersQuerySchema>) {
    return this.offers.list(user, q.box);
  }

  @Get(':id')
  thread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.thread(user, id);
  }

  @Post(':id/counter')
  @ApiZodBody(offerCounterSchema)
  counter(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(offerCounterSchema) body: z.infer<typeof offerCounterSchema>) {
    return this.offers.counter(user, id, body);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.accept(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiZodBody(offerRejectSchema)
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(offerRejectSchema) body: z.infer<typeof offerRejectSchema>) {
    return this.offers.reject(user, id, body.reason ?? null);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.withdraw(user, id);
  }

  /** Regenerate the contract PDF (participants of an accepted thread). */
  @Post(':id/contract')
  @HttpCode(200)
  regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.regenerateContract(user, id);
  }

  /** Contract PDF download (P17). Personal data → participants only, never a public URL. */
  @Get(':id/contract')
  async contract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.offers.contractFile(user, id);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="${filename}"`);
    res.setHeader('cache-control', 'private, no-store');
    res.send(buffer);
  }
}
