import type { CheckoutRequest, PaymentProvider, WebhookEvent } from './payments';
import { hmacHex, optionalMinor, parseJsonObject, requireString, verifyHmacSignature } from './payments';

/**
 * Mock PSP with the same shape as the real ones: hosted checkout page (rendered by apps/web at
 * /checkout/mock/:paymentId) and HMAC-SHA256 signed webhooks (`x-signature`).
 */
export class MockPayments implements PaymentProvider {
  readonly name = 'mock' as const;
  constructor(
    private readonly secret: string,
    private readonly appUrl: string,
  ) {}

  async createCheckout(req: CheckoutRequest) {
    const providerRef = `mock_${req.paymentId}`;
    const q = new URLSearchParams({ ref: providerRef, amount: String(req.amountMinor), desc: req.description, return: req.returnUrl });
    return { providerRef, checkoutUrl: `${this.appUrl}/checkout/mock/${req.paymentId}?${q}` };
  }

  sign(rawBody: string) {
    return hmacHex(this.secret, rawBody);
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent {
    if (!verifyHmacSignature(this.secret, rawBody, headers['x-signature'])) throw new Error('invalid signature');
    const body = parseJsonObject(rawBody);
    const status = body.status;
    if (status !== 'succeeded' && status !== 'failed' && status !== 'refunded') throw new Error('invalid status');
    return {
      eventId: requireString(body.id, 'id'),
      providerRef: requireString(body.ref, 'ref'),
      status,
      amountMinor: optionalMinor(body.amount),
      currency: typeof body.currency === 'string' ? body.currency.toUpperCase() : undefined,
      raw: body,
    };
  }
}
