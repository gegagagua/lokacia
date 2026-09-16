import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { demandContactSchema, demandCreateSchema, demandListQuerySchema, type DemandListQuery } from '@lokacia/contracts';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { DemandService } from './demand.service';

@ApiTags('demand')
@Controller('v1/demand')
export class DemandController {
  constructor(private readonly demand: DemandService) {}

  @Public()
  @Get()
  list(@ZQuery(demandListQuerySchema) q: DemandListQuery, @CurrentUser() user?: AuthUser) {
    return this.demand.list(q, user);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.demand.mine(user);
  }

  @Post()
  @ApiZodBody(demandCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(demandCreateSchema) body: z.infer<typeof demandCreateSchema>) {
    return this.demand.create(user, body);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.demand.detail(id, user);
  }

  @Public()
  @Get(':id/matches')
  matches(@Param('id') id: string) {
    return this.demand.matches(id);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.demand.close(user, id);
  }

  @Post(':id/renew')
  @HttpCode(200)
  renew(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.demand.renew(user, id);
  }

  @Post(':id/contact')
  @HttpCode(200)
  @ApiZodBody(demandContactSchema)
  contact(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(demandContactSchema) body: z.infer<typeof demandContactSchema>) {
    return this.demand.contact(user, id, body.body, body.listingId);
  }
}
