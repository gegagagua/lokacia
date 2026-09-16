'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

export function MockPayActions({ paymentId, amount }: { paymentId: string; amount: string }) {
  const t = useTranslations('billing.mock');
  const [busy, setBusy] = React.useState<'succeeded' | 'failed' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const complete = async (outcome: 'succeeded' | 'failed') => {
    setBusy(outcome);
    setError(null);
    try {
      const r = await apiFetch<{ status: string; redirectUrl: string }>(`/billing/payments/${paymentId}/mock-complete`, { method: 'POST', body: { outcome } });
      window.location.href = r.redirectUrl;
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : t('error'));
      setBusy(null);
    }
  };
  return (
    <div className="mt-5 flex flex-col gap-2">
      <Button size="lg" onClick={() => complete('succeeded')} loading={busy === 'succeeded'} disabled={!!busy}>
        {t('pay', { amount })}
      </Button>
      <Button variant="ghost" onClick={() => complete('failed')} loading={busy === 'failed'} disabled={!!busy}>
        {t('decline')}
      </Button>
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
