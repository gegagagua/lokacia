import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CheckoutRequest, PaymentProvider, WebhookEvent } from './payments';

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
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent {
    const sig = String(headers['x-signature'] ?? '');
    const expected = this.sign(rawBody);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('invalid signature');
    const body = JSON.parse(rawBody) as { id: string; ref: string; status: WebhookEvent['status']; amount?: number };
    return { eventId: body.id, providerRef: body.ref, status: body.status, amountMinor: body.amount, raw: body };
  }
}
