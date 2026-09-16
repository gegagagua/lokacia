import { Controller, Get, Inject, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, eq, isNull, listings, ne, reviews, sql, users } from '@lokacia/db';
import { brokerProfileSchema, type BrokerProfile } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import type { AppRequest } from '../../../common/request';
import { ENV, type Env } from '../../../config/env';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { Crm, Ctx, type CrmCtx } from '../shared/crm-access';

/** C12: broker edits own public profile (bio, slug, avatar). The public mini-site is `/broker/:slug` on the portal. */
@ApiTags('crm')
@Controller('v1/crm/profile')
@Crm()
export class CrmProfileController {
  constructor(
    private readonly dbs: DbService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async load(ctx: CrmCtx): Promise<BrokerProfile> {
    const u = await this.dbs.db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
    if (!u) throw problems.notFound('მომხმარებელი');
    const [cnt] = await this.dbs.db
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(eq(listings.orgId, ctx.orgId), isNull(listings.deletedAt), sql`coalesce(${listings.agentId}, ${listings.ownerId}) = ${ctx.userId}`, sql`${listings.status} in ('active','stale')`));
    const [rev] = await this.dbs.db
      .select({ n: sql<number>`count(*)::int`, avg: sql<string | null>`avg(${reviews.rating})` })
      .from(reviews)
      .where(and(eq(reviews.targetType, 'broker'), eq(reviews.targetId, ctx.userId), isNull(reviews.deletedAt)));
    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      bio: u.bio,
      slug: u.slug,
      avatarUrl: u.avatarUrl,
      publicUrl: u.slug ? `${this.env.APP_URL}/broker/${u.slug}` : null,
      listingsCount: cnt?.n ?? 0,
      reviews: { count: rev?.n ?? 0, avg: rev?.avg ? Math.round(Number(rev.avg) * 10) / 10 : null },
    };
  }

  @Get()
  get(@Ctx() ctx: CrmCtx) {
    return this.load(ctx);
  }

  @Patch()
  @ApiZodBody(brokerProfileSchema)
  async update(@Ctx() ctx: CrmCtx, @ZBody(brokerProfileSchema) body: z.infer<typeof brokerProfileSchema>, @Req() req: AppRequest) {
    const sent = new Set(Object.keys((req.body as object) ?? {}));
    const patch = Object.fromEntries(Object.entries(body).filter(([k]) => sent.has(k))) as typeof body;
    if (patch.slug) {
      const taken = await this.dbs.db.query.users.findFirst({ where: and(eq(users.slug, patch.slug), ne(users.id, ctx.userId)) });
      if (taken) throw problems.conflict('ეს მისამართი უკვე დაკავებულია');
    }
    if (Object.keys(patch).length) await this.dbs.db.update(users).set(patch).where(eq(users.id, ctx.userId));
    return this.load(ctx);
  }
}
