import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { compareCreateSchema, compareUpdateSchema, favoriteAddSchema } from '@lokacia/contracts';
import { ClientIp, CurrentUser, Public, SkipAudit } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody } from '../../common/zod';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@Controller('v1/favorites')
@SkipAudit()
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.svc.ids(user);
  }

  @Post()
  @HttpCode(200)
  @ApiZodBody(favoriteAddSchema)
  add(@CurrentUser() user: AuthUser, @ZBody(favoriteAddSchema) body: z.infer<typeof favoriteAddSchema>, @ClientIp() ip: string) {
    return this.svc.add(user, body.listingId, body.note, ip);
  }

  @Delete(':listingId')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.svc.remove(user, listingId);
  }
}

@ApiTags('compare')
@Controller('v1/compare')
export class CompareController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.compareLists(user);
  }

  @Post()
  @ApiZodBody(compareCreateSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(compareCreateSchema) body: z.infer<typeof compareCreateSchema>) {
    return this.svc.createCompare(user, body.name, body.listingIds);
  }

  @Public()
  @Get('shared/:token')
  shared(@Param('token') token: string) {
    return this.svc.shared(token);
  }

  @Patch(':id')
  @ApiZodBody(compareUpdateSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(compareUpdateSchema) body: z.infer<typeof compareUpdateSchema>) {
    return this.svc.updateCompare(user, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteCompare(user, id);
  }
}
