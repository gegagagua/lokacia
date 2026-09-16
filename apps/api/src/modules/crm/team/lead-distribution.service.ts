import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, asc, crmContacts, eq, inArray, isNotNull, isNull, memberships, organizations, sql, users } from '@lokacia/db';
import { ENV, type Env } from '../../../config/env';
import { DbService } from '../../../common/db.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivityService } from '../shared/activity.service';
import { CrmEventsService } from '../shared/crm-events.service';

/**
 * C17 automatic lead distribution on new lead creation.
 * round_robin: next active agent/manager by organizations.rr_cursor; district: members whose districts overlap the
 * client's requirement districts (round robin among them), falling back to round robin; manual: nothing.
 */
@Injectable()
export class LeadDistributionService implements OnModuleInit {
  private readonly logger = new Logger('LeadDistribution');
  constructor(
    private readonly dbs: DbService,
    private readonly events: CrmEventsService,
    private readonly activities: ActivityService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.events.on('contact.created', (p) => this.distribute(p.orgId, p.contactId));
  }

  async candidates(orgId: string) {
    return this.dbs.db
      .select({ userId: memberships.userId, districtIds: memberships.districtIds })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.active, true), isNull(memberships.deletedAt), isNotNull(memberships.userId), inArray(memberships.role, ['agent', 'manager'])))
      .orderBy(sql`${memberships.acceptedAt} asc nulls last`, asc(memberships.createdAt), asc(memberships.id));
  }

  /** Assigns the contact. `force` re-runs for an already assigned contact (and uses round robin when mode is manual). */
  async distribute(orgId: string, contactId: string, opts: { force?: boolean } = {}): Promise<{ agentId: string | null; mode: string; reason: string }> {
    const org = await this.dbs.db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    if (!org) return { agentId: null, mode: 'none', reason: 'org' };
    const mode = org.leadDistribution;
    if (mode === 'manual' && !opts.force) return { agentId: null, mode, reason: 'manual' };
    const contact = await this.dbs.org(orgId, (tx) => tx.query.crmContacts.findFirst({ where: and(eq(crmContacts.id, contactId), isNull(crmContacts.deletedAt)) }));
    if (!contact) return { agentId: null, mode, reason: 'not-found' };
    if (contact.ownerAgentId && !opts.force) return { agentId: contact.ownerAgentId, mode, reason: 'already-assigned' };
    const all = await this.candidates(orgId);
    if (!all.length) return { agentId: null, mode, reason: 'no-candidates' };
    let pool = all;
    let reason = 'round_robin';
    const wanted = contact.requirements?.districtIds ?? [];
    if (mode === 'district' && wanted.length) {
      const matching = all.filter((c) => c.districtIds.some((d) => wanted.includes(d)));
      if (matching.length) {
        pool = matching;
        reason = 'district';
      } else reason = 'district-fallback';
    }
    const [cur] = await this.dbs.db.update(organizations).set({ rrCursor: sql`${organizations.rrCursor} + 1` }).where(eq(organizations.id, orgId)).returning({ rrCursor: organizations.rrCursor });
    const index = ((cur!.rrCursor - 1) % pool.length + pool.length) % pool.length;
    const agentId = pool[index]!.userId!;
    const agent = await this.dbs.db.query.users.findFirst({ where: eq(users.id, agentId) });
    await this.dbs.org(orgId, async (tx) => {
      await tx.update(crmContacts).set({ ownerAgentId: agentId }).where(eq(crmContacts.id, contactId));
      await this.activities.log(orgId, { entity: 'contact', entityId: contactId, type: 'note', payload: { body: `ლიდი ავტომატურად მიენიჭა: ${agent?.name ?? '—'}`, system: true, distribution: reason }, createdBy: null }, tx);
    });
    await this.notify
      .notify({ userId: agentId, template: 'crm_lead_assigned', vars: { contact: contact.name, source: contact.source ?? '' }, link: `${this.env.CRM_URL}/contacts/${contactId}`, category: 'crm' })
      .catch((e: Error) => this.logger.warn(`notify failed: ${e.message}`));
    return { agentId, mode, reason };
  }
}
