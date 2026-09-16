import { Logger } from '@nestjs/common';
import type { SmsProvider } from './sms';

/** Dev/test SMS: logs and keeps an in-memory outbox (tests read `outbox`). */
export class MockSms implements SmsProvider {
  readonly name = 'mock';
  readonly outbox: { to: string; text: string; at: Date }[] = [];
  private readonly logger = new Logger('SMS(mock)');
  async send(to: string, text: string) {
    this.outbox.push({ to, text, at: new Date() });
    if (this.outbox.length > 500) this.outbox.shift();
    this.logger.log(`→ ${to}: ${text}`);
    return { id: `mock-${Date.now()}` };
  }
}
