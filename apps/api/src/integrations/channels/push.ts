import { Logger } from '@nestjs/common';
import type { MessageChannel, OutboundMessage } from './channels';

/**
 * Mobile push (V7) via Expo Push Service (which fans out to APNs / FCM with the credentials uploaded to EAS).
 * `to` is either a comma-separated list of Expo push tokens (`ExponentPushToken[...]`) or, for legacy web-push
 * callers, a user id — non-Expo recipients are ignored by the live adapter.
 */
export function expoTokens(to: string): string[] {
  return to
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
}

type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

export class ExpoPushChannel implements MessageChannel {
  readonly name = 'push' as const;
  readonly live = true;
  private readonly logger = new Logger('push(expo)');
  constructor(
    private readonly accessToken: string,
    private readonly endpoint = 'https://exp.host/--/api/v2/push/send',
  ) {}

  async send(msg: OutboundMessage) {
    const tokens = expoTokens(msg.to);
    if (!tokens.length) return { id: 'push-skipped-no-device' };
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}) },
      body: JSON.stringify(tokens.map((to) => ({ to, title: msg.title, body: msg.body, sound: 'default', data: msg.link ? { link: msg.link } : {} }))),
    });
    if (!res.ok) throw new Error(`expo push ${res.status}`);
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const failed = (json.data ?? []).filter((t) => t.status === 'error');
    if (failed.length) this.logger.warn(`expo push errors: ${failed.map((f) => f.details?.error ?? f.message).join(', ')}`);
    return { id: (json.data ?? []).map((t) => t.id).filter(Boolean).join(',') || `expo-${Date.now()}` };
  }
}

/** Dev/test adapter: logs what would be pushed and keeps an outbox for tests. */
export class MockPushChannel implements MessageChannel {
  readonly name = 'push' as const;
  readonly live = false;
  readonly outbox: (OutboundMessage & { at: Date; tokens: string[] })[] = [];
  private readonly logger = new Logger('push(mock)');

  async send(msg: OutboundMessage) {
    const tokens = expoTokens(msg.to);
    this.outbox.push({ ...msg, at: new Date(), tokens });
    if (this.outbox.length > 500) this.outbox.shift();
    this.logger.log(`→ ${tokens.length ? `${tokens.length} device(s)` : msg.to}: ${msg.title ?? ''} ${msg.body.slice(0, 120)}`);
    return { id: `mock-push-${Date.now()}` };
  }
}
