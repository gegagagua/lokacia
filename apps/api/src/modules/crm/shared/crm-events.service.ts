import { Injectable, Logger } from '@nestjs/common';

/**
 * In-process CRM domain events so submodules stay decoupled (e.g. contacts → lead distribution / sequences,
 * deals won → stop sequences, inbound message → stop sequences, viewing done → after_viewing sequence).
 * `emit` awaits every handler (deterministic in tests); a failing handler is logged, never breaks the request.
 * Heavy/slow work inside handlers must still go through QueueService.
 */
export type CrmEventMap = {
  'contact.created': { orgId: string; contactId: string; actorId: string | null; source: string | null };
  'contact.updated': { orgId: string; contactId: string; actorId: string | null };
  'contact.requirements_changed': { orgId: string; contactId: string };
  'contact.merged': { orgId: string; targetId: string; sourceIds: string[] };
  'deal.created': { orgId: string; dealId: string; contactId: string; actorId: string | null };
  'deal.stage_changed': { orgId: string; dealId: string; contactId: string; from: string; to: string; kind: 'open' | 'won' | 'lost'; actorId: string | null };
  'viewing.created': { orgId: string; viewingId: string; contactId: string | null; dealId: string | null };
  'viewing.done': { orgId: string; viewingId: string; contactId: string | null; dealId: string | null };
  'message.inbound': { orgId: string; conversationId: string; contactId: string | null; channel: string };
  'task.created': { orgId: string; taskId: string; assigneeId: string | null };
};
export type CrmEventName = keyof CrmEventMap;
type Handler<K extends CrmEventName> = (payload: CrmEventMap[K]) => Promise<unknown> | unknown;

@Injectable()
export class CrmEventsService {
  private readonly logger = new Logger('CrmEvents');
  private readonly handlers = new Map<CrmEventName, Handler<never>[]>();

  on<K extends CrmEventName>(name: K, handler: Handler<K>) {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(name, list);
  }

  async emit<K extends CrmEventName>(name: K, payload: CrmEventMap[K]) {
    for (const h of this.handlers.get(name) ?? []) {
      try {
        await (h as Handler<K>)(payload);
      } catch (e) {
        this.logger.warn(`${name} handler failed: ${(e as Error).message}`);
      }
    }
  }
}
