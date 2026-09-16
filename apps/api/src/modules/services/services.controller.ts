import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { providerListQuerySchema, reviewCreateSchema, serviceOrderStatusSchema, serviceQuoteRequestSchema, serviceQuoteSchema } from '@lokacia/contracts';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/request';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('v1/services')
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.svc.categories();
  }

  @Public()
  @Get('providers')
  providers(@ZQuery(providerListQuerySchema) q: z.infer<typeof providerListQuerySchema>) {
    return this.svc.providers(q);
  }

  @Get('providers/me')
  me(@CurrentUser() user: AuthUser) {
    return this.svc.myProvider(user);
  }

  @Public()
  @Get('providers/:slug')
  provider(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.svc.provider(slug, user);
  }

  @Post('providers/:slug/reviews')
  @ApiZodBody(reviewCreateSchema)
  review(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @ZBody(reviewCreateSchema) body: z.infer<typeof reviewCreateSchema>) {
    return this.svc.review(user, slug, body);
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthUser, @Query('role') role?: 'provider' | 'requester') {
    return this.svc.orders(user, role === 'provider' || role === 'requester' ? role : undefined);
  }

  @Post('orders')
  @ApiZodBody(serviceQuoteRequestSchema)
  request(@CurrentUser() user: AuthUser, @ZBody(serviceQuoteRequestSchema) body: z.infer<typeof serviceQuoteRequestSchema>) {
    return this.svc.requestQuote(user, body);
  }

  @Post('orders/:id/quote')
  @HttpCode(200)
  @ApiZodBody(serviceQuoteSchema)
  quote(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(serviceQuoteSchema) body: z.infer<typeof serviceQuoteSchema>) {
    return this.svc.quote(user, id, body);
  }

  @Post('orders/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.accept(user, id);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @ApiZodBody(serviceOrderStatusSchema)
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(serviceOrderStatusSchema) body: z.infer<typeof serviceOrderStatusSchema>) {
    return this.svc.setStatus(user, id, body.status);
  }
}
