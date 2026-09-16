'use client';
import type { CheckoutRequest, CheckoutResponse } from '@lokacia/contracts';
import { apiFetch, ClientApiError } from '@/lib/api-client';

export function newIdempotencyKey(prefix = 'web') {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rnd}`;
}

/** Starts a checkout and navigates to the provider page (or result page when paid instantly). Returns null when redirected to login. */
export async function startCheckout(body: Partial<CheckoutRequest> & { planKey: string }, opts: { loginNext?: string } = {}): Promise<CheckoutResponse | null> {
  try {
    const res = await apiFetch<CheckoutResponse>('/billing/checkout', { method: 'POST', body: { idempotencyKey: newIdempotencyKey(body.planKey), ...body } });
    window.location.href = res.status === 'redirect' && res.checkoutUrl ? res.checkoutUrl : res.redirectUrl;
    return res;
  } catch (e) {
    if (e instanceof ClientApiError && e.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(opts.loginNext ?? window.location.pathname + window.location.search)}`;
      return null;
    }
    throw e;
  }
}

/** Follows a CheckoutResponse returned by other endpoints (rent, escrow). */
export function followCheckout(res: CheckoutResponse) {
  window.location.href = res.status === 'redirect' && res.checkoutUrl ? res.checkoutUrl : res.redirectUrl;
}
