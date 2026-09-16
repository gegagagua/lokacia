export type CheckoutRequest = { paymentId: string; invoiceNumber: string; amountMinor: number; currency: string; description: string; returnUrl: string };
export type CheckoutResult = { providerRef: string; checkoutUrl: string };
export type WebhookEvent = { eventId: string; providerRef: string; status: 'succeeded' | 'failed' | 'refunded'; amountMinor?: number; raw: unknown };

export interface PaymentProvider {
  readonly name: 'mock' | 'bog' | 'tbc' | 'psp';
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Verifies signature and parses the provider webhook. Throws on invalid signature. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent;
  refund?(providerRef: string, amountMinor: number): Promise<void>;
}
export const PAYMENTS = Symbol('PAYMENTS');
