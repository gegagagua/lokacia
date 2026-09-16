import { createHmac } from 'node:crypto';
import type { CheckoutRequest, PaymentProvider, WebhookEvent } from './payments';

/**
 * Bank adapters (sandbox-shaped). Real endpoints/credentials require merchant contracts — see docs/HUMAN_TODO.md.
 * They implement the request/verification shape so switching PAYMENTS_PROVIDER needs only credentials.
 */
abstract class HttpBankProvider implements PaymentProvider {
  abstract readonly name: 'bog' | 'tbc' | 'psp';
  protected abstract readonly baseUrl: string;
  constructor(
    protected readonly apiKey: string,
    protected readonly webhookSecret: string,
  ) {}

  async createCheckout(req: CheckoutRequest) {
    if (!this.apiKey) throw new Error(`${this.name}: merchant credentials are not configured`);
    const res = await fetch(`${this.baseUrl}/payments/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}`, 'idempotency-key': req.paymentId },
      body: JSON.stringify({ external_order_id: req.paymentId, amount: req.amountMinor / 100, currency: req.currency, description: req.description, callback_url: req.returnUrl }),
    });
    if (!res.ok) throw new Error(`${this.name}: checkout failed (${res.status})`);
    const json = (await res.json()) as { id: string; redirect_url: string };
    return { providerRef: json.id, checkoutUrl: json.redirect_url };
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent {
    const sig = String(headers['x-signature'] ?? headers['callback-signature'] ?? '');
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    if (sig !== expected) throw new Error('invalid signature');
    const b = JSON.parse(rawBody) as { event_id: string; order_id: string; status: string; amount?: number };
    const status = b.status === 'completed' || b.status === 'succeeded' ? 'succeeded' : b.status === 'refunded' ? 'refunded' : 'failed';
    return { eventId: b.event_id, providerRef: b.order_id, status, amountMinor: b.amount ? Math.round(b.amount * 100) : undefined, raw: b };
  }
}

export class BogPayments extends HttpBankProvider {
  readonly name = 'bog' as const;
  protected readonly baseUrl = 'https://api.bog.ge/payments/v1';
}
export class TbcPayments extends HttpBankProvider {
  readonly name = 'tbc' as const;
  protected readonly baseUrl = 'https://api.tbcbank.ge/v1/tpay';
}
export class PspPayments extends HttpBankProvider {
  readonly name = 'psp' as const;
  protected readonly baseUrl = process.env.PSP_API_URL ?? 'https://psp.invalid';
}
