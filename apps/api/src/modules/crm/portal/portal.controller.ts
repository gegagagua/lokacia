import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { and, crmContacts, crmMatches, eq, inArray, isNull, organizations, users } from '@lokacia/db';
import { MATCH_STATUS_LABELS_KA, portalReactionSchema, type PortalView } from '@lokacia/contracts';
import { ClientIp, Public, SkipAudit } from '../../../common/decorators';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { RateLimitService } from '../../../common/redis.service';
import { TokensService } from '../../../common/tokens.service';
import { ApiZodBody, ZBody } from '../../../common/zod';
import { ENV, type Env } from '../../../config/env';
import { ListingReadService } from '../../listings/listing-read.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';

const PORTAL_STATUSES = ['sent', 'liked', 'disliked'] as const;

/** C8 client portal: public tokenized page with curated spaces and like/dislike feedback. */
@ApiTags('crm-portal')
@Controller('v1/crm/portal')
@Public()
export class CrmPortalController {
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly activities: ActivityService,
    private readonly notify: NotificationsService,
    private readonly rate: RateLimitService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Resolves the token to a live contact (follows merges). */
  private async contactByToken(token: string) {
    if (!/^[\w-]{8,64}$/.test(token)) throw problems.notFound('ბმული');
    return this.dbs.system(async (tx) => {
      let c = await tx.query.crmContacts.findFirst({ where: eq(crmContacts.portalToken, token) });
      for (let i = 0; c?.mergedIntoId && i < 5; i++) c = await tx.query.crmContacts.findFirst({ where: eq(crmContacts.id, c.mergedIntoId) });
      if (!c || c.deletedAt) throw problems.notFound('ბმული');
      return c;
    });
  }

  @Get(':token')
  @SkipAudit()
  async view(@Param('token') token: string): Promise<PortalView> {
    const c = await this.contactByToken(token);
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, c.orgId) });
    const agent = c.ownerAgentId ? await this.dbs.db.query.users.findFirst({ where: eq(users.id, c.ownerAgentId) }) : null;
    const matches = await this.dbs.system((tx) =>
      tx
        .select()
        .from(crmMatches)
        .where(and(eq(crmMatches.contactId, c.id), isNull(crmMatches.deletedAt), inArray(crmMatches.status, [...PORTAL_STATUSES])))
        .orderBy(crmMatches.createdAt),
    );
    const cards = await this.read.cards(matches.map((m) => m.listingId));
    const byId = new Map(cards.map((x) => [x.id, x]));
    return {
      org: { name: org?.name ?? 'lokacia.ge', logoUrl: org?.logoUrl ?? null, brandColor: org?.brandColor ?? null, phone: org?.phone ?? null },
      contact: { firstName: c.name.split(' ')[0] ?? c.name },
      agent: agent ? { name: agent.name, phone: agent.phone } : null,
      items: matches
        .filter((m) => byId.has(m.listingId))
        .map((m) => {
          const l = byId.get(m.listingId)!;
          return {
            matchId: m.id,
            status: m.status,
            comment: m.clientComment,
            listing: { id: l.id, slug: l.slug, title: l.title, address: l.address, priceMinor: l.priceMinor, pricePeriod: l.pricePeriod, areaM2: l.areaM2, dealType: l.dealType, cover: l.cover, districtName: l.districtName },
          };
        }),
    };
  }

  @Post(':token/matches/:matchId')
  @HttpCode(200)
  @ApiZodBody(portalReactionSchema)
  async react(@Param('token') token: string, @Param('matchId') matchId: string, @ZBody(portalReactionSchema) body: z.infer<typeof portalReactionSchema>, @ClientIp() ip: string) {
    await this.rate.hit(`crm-portal:${this.tokens.ipHash(ip)}`, 120, 3600);
    const c = await this.contactByToken(token);
    const { match, listingTitle } = await this.dbs.system(async (tx) => {
      const m = await tx.query.crmMatches.findFirst({ where: and(eq(crmMatches.id, matchId), eq(crmMatches.contactId, c.id), isNull(crmMatches.deletedAt)) });
      if (!m || !(PORTAL_STATUSES as readonly string[]).includes(m.status)) throw problems.notFound('ფართი');
      const [updated] = await tx.update(crmMatches).set({ status: body.reaction, clientComment: body.comment ?? m.clientComment }).where(eq(crmMatches.id, m.id)).returning();
      const l = await tx.query.listings.findFirst({ where: (t, { eq: e }) => e(t.id, m.listingId) });
      await this.activities.log(c.orgId, { entity: 'contact', entityId: c.id, type: 'match', payload: { body: `კლიენტი: ${MATCH_STATUS_LABELS_KA[body.reaction]} — ${l?.title ?? ''}${body.comment ? ` („${body.comment}“)` : ''}`, listingId: m.listingId, reaction: body.reaction } }, tx);
      return { match: updated!, listingTitle: l?.title ?? '' };
    });
    if (c.ownerAgentId) {
      await this.notify.notify({
        userId: c.ownerAgentId,
        template: 'crm_portal_feedback',
        category: 'crm',
        vars: { contact: c.name, reaction: MATCH_STATUS_LABELS_KA[body.reaction], title: listingTitle },
        link: `${this.env.CRM_URL}/contacts/${c.id}?tab=matches`,
      });
    }
    return { matchId: match.id, status: match.status, comment: match.clientComment };
  }
}
