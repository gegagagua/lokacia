import type { CheckoutRequest, PaymentProvider, WebhookEvent } from './payments';
import { parseJsonObject, requireString, verifyHmacSignature } from './payments';

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
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${this.name}: checkout failed (${res.status})`);
    const json = (await res.json()) as { id: string; redirect_url: string };
    return { providerRef: json.id, checkoutUrl: json.redirect_url };
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent {
    // timing-safe HMAC over the exact raw bytes received (never re-serialized JSON)
    if (!verifyHmacSignature(this.webhookSecret, rawBody, headers['x-signature'] ?? headers['callback-signature'])) throw new Error('invalid signature');
    const b = parseJsonObject(rawBody);
    const s = requireString(b.status, 'status', 40);
    const status = s === 'completed' || s === 'succeeded' ? 'succeeded' : s === 'refunded' ? 'refunded' : 'failed';
    let amountMinor: number | undefined;
    if (b.amount !== undefined && b.amount !== null) {
      if (typeof b.amount !== 'number' || !Number.isFinite(b.amount) || b.amount < 0) throw new Error('invalid amount');
      amountMinor = Math.round(b.amount * 100);
    }
    return {
      eventId: requireString(b.event_id, 'event_id'),
      providerRef: requireString(b.order_id, 'order_id'),
      status,
      amountMinor,
      currency: typeof b.currency === 'string' ? b.currency.toUpperCase() : undefined,
      raw: b,
    };
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
