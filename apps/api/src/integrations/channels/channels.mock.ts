import { Logger } from '@nestjs/common';
import type { ChannelName, MessageChannel, OutboundMessage } from './channels';

export class MockChannel implements MessageChannel {
  readonly live = false;
  readonly outbox: (OutboundMessage & { at: Date })[] = [];
  private readonly logger: Logger;
  constructor(readonly name: ChannelName) {
    this.logger = new Logger(`${name}(mock)`);
  }
  async send(msg: OutboundMessage) {
    this.outbox.push({ ...msg, at: new Date() });
    if (this.outbox.length > 500) this.outbox.shift();
    this.logger.log(`→ ${msg.to}: ${msg.title ?? ''} ${msg.body.slice(0, 120)}`);
    return { id: `mock-${this.name}-${Date.now()}` };
  }
}
