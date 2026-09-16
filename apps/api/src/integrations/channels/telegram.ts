import type { MessageChannel, OutboundMessage } from './channels';

/** Telegram Bot API adapter. `to` is the chat id linked via deep link /start <token>. */
export class TelegramChannel implements MessageChannel {
  readonly name = 'telegram' as const;
  readonly live = true;
  constructor(private readonly token: string) {}
  async send(msg: OutboundMessage) {
    const text = [msg.title ? `*${msg.title}*` : '', msg.body, msg.link ?? ''].filter(Boolean).join('\n');
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: msg.to, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok) throw new Error(`telegram: ${json.description}`);
    return { id: String(json.result?.message_id) };
  }
}

export class ViberChannel implements MessageChannel {
  readonly name = 'viber' as const;
  readonly live = true;
  constructor(private readonly token: string) {}
  async send(msg: OutboundMessage) {
    const res = await fetch('https://chatapi.viber.com/pa/send_message', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Viber-Auth-Token': this.token },
      body: JSON.stringify({ receiver: msg.to, type: 'text', sender: { name: 'lokacia.ge' }, text: [msg.title, msg.body, msg.link].filter(Boolean).join('\n') }),
    });
    const json = (await res.json()) as { status: number; message_token?: number; status_message?: string };
    if (json.status !== 0) throw new Error(`viber: ${json.status_message}`);
    return { id: String(json.message_token) };
  }
}
