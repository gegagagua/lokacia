import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { escrowCreateSchema, escrowDisputeSchema } from '@lokacia/contracts';
import { CurrentUser, NoImpersonation } from '../../../common/decorators';
import type { AuthUser } from '../../../common/request';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { EscrowService } from './escrow.service';

const uuid = z.string().uuid();

@ApiTags('escrow')
@Controller('v1/escrow')
export class EscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.escrow.mine(user);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrow.dto(await this.escrow.get(user, uuid.parse(id)), user);
  }

  @Post()
  @ApiZodBody(escrowCreateSchema)
  async create(@CurrentUser() user: AuthUser, @ZBody(escrowCreateSchema) body: z.infer<typeof escrowCreateSchema>) {
    return this.escrow.dto(await this.escrow.create(user, body.offerId), user);
  }

  @Post(':id/sign')
  @NoImpersonation()
  @HttpCode(200)
  async sign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrow.dto(await this.escrow.sign(user, uuid.parse(id)), user);
  }

  @Post(':id/fund')
  @NoImpersonation()
  @HttpCode(200)
  fund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrow.fund(user, uuid.parse(id));
  }

  @Post(':id/release')
  @NoImpersonation()
  @HttpCode(200)
  async release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrow.dto(await this.escrow.release(user, uuid.parse(id)), user);
  }

  @Post(':id/refund')
  @NoImpersonation()
  @HttpCode(200)
  async refund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrow.dto(await this.escrow.refund(user, uuid.parse(id)), user);
  }

  @Post(':id/dispute')
  @HttpCode(200)
  @ApiZodBody(escrowDisputeSchema)
  async dispute(@CurrentUser() user: AuthUser, @Param('id') id: string, @ZBody(escrowDisputeSchema) body: z.infer<typeof escrowDisputeSchema>) {
    return this.escrow.dto(await this.escrow.dispute(user, uuid.parse(id), body.reason), user);
  }

  @Get(':id/contract.pdf')
  async contract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.escrow.contractPdf(user, uuid.parse(id));
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="contract-${id.slice(0, 8)}.pdf"`);
    res.send(buf);
  }
}
