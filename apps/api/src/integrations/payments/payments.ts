import { createHmac, timingSafeEqual } from 'node:crypto';

export type CheckoutRequest = { paymentId: string; invoiceNumber: string; amountMinor: number; currency: string; description: string; returnUrl: string };
export type CheckoutResult = { providerRef: string; checkoutUrl: string };
export type WebhookEvent = {
  eventId: string;
  providerRef: string;
  status: 'succeeded' | 'failed' | 'refunded';
  amountMinor?: number;
  /** ISO 4217, upper-case; when present it must match the invoice currency. */
  currency?: string;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: 'mock' | 'bog' | 'tbc' | 'psp';
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Verifies signature over the exact raw request body and parses the provider webhook. Throws on invalid signature/payload. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): WebhookEvent;
  refund?(providerRef: string, amountMinor: number): Promise<void>;
}
export const PAYMENTS = Symbol('PAYMENTS');

/** HMAC-SHA256 hex of the raw body. */
export function hmacHex(secret: string, rawBody: string) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Constant-time comparison of a provided hex signature (optionally `sha256=`-prefixed) with the expected HMAC. */
export function verifyHmacSignature(secret: string, rawBody: string, provided: string | string[] | undefined): boolean {
  if (!secret) return false;
  const sig = ((Array.isArray(provided) ? provided[0] : provided) ?? '').trim().replace(/^sha256=/i, '').toLowerCase();
  const expected = hmacHex(secret, rawBody);
  if (!/^[0-9a-f]+$/.test(sig) || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
}

/** Parses JSON and asserts it is a plain object (throws otherwise). */
export function parseJsonObject(rawBody: string): Record<string, unknown> {
  const v: unknown = JSON.parse(rawBody);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('payload must be a JSON object');
  return v as Record<string, unknown>;
}

export function requireString(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || !v.length || v.length > max) throw new Error(`invalid ${field}`);
  return v;
}

/** Non-negative safe integer (minor units) or undefined. */
export function optionalMinor(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('invalid amount');
  return v;
}
