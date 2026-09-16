export type ChannelName = 'email' | 'telegram' | 'viber' | 'whatsapp' | 'push';
export type OutboundMessage = { to: string; title?: string; body: string; link?: string; attachments?: { filename: string; content: string; contentType: string }[] };

export interface MessageChannel {
  readonly name: ChannelName;
  readonly live: boolean;
  send(msg: OutboundMessage): Promise<{ id: string }>;
}
export const CHANNELS = Symbol('CHANNELS');
