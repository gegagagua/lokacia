import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { crmContacts, crmDeals, eq } from '@lokacia/db';
import { callLogSchema } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { ActivityService } from '../shared/activity.service';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';

/** C7 click-to-call: after a `tel:` click the UI opens the call log dialog and posts the outcome here. */
@ApiTags('crm')
@Controller('v1/crm/calls')
@Crm()
export class CrmCallsController {
  constructor(
    private readonly dbs: DbService,
    private readonly activities: ActivityService,
  ) {}

  @Post()
  @ApiZodBody(callLogSchema)
  async create(@Ctx() ctx: CrmCtx, @ZBody(callLogSchema) body: z.infer<typeof callLogSchema>) {
    const { entity, entityId, ...payload } = body;
    return this.dbs.org(ctx.orgId, async (tx) => {
      const row = await this.activities.log(ctx.orgId, { entity, entityId, type: 'call', payload, createdBy: ctx.userId }, tx);
      const contactId = entity === 'contact' ? entityId : (await tx.query.crmDeals.findFirst({ where: eq(crmDeals.id, entityId) }))?.contactId;
      if (contactId) await tx.update(crmContacts).set({ lastContactedAt: new Date() }).where(eq(crmContacts.id, contactId));
      return row;
    });
  }
}
