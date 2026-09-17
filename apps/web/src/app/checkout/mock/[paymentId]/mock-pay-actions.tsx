'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { withBase } from '@/lib/base-path';

export function MockPayActions({ paymentId, amount }: { paymentId: string; amount: string }) {
  const t = useTranslations('billing.mock');
  const [busy, setBusy] = React.useState<'succeeded' | 'failed' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const complete = async (outcome: 'succeeded' | 'failed') => {
    setBusy(outcome);
    setError(null);
    try {
      const r = await apiFetch<{ status: string; redirectUrl: string }>(`/billing/payments/${paymentId}/mock-complete`, { method: 'POST', body: { outcome } });
      window.location.href = withBase(r.redirectUrl);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : t('error'));
      setBusy(null);
    }
  };
  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={() => complete('succeeded')} loading={busy === 'succeeded'} disabled={!!busy} icon={<Lock className="size-4" strokeWidth={2} aria-hidden />}>
        {t('pay', { amount })}
      </Button>
      <Button variant="ghost" className="w-full text-muted hover:text-danger" onClick={() => complete('failed')} loading={busy === 'failed'} disabled={!!busy}>
        {t('decline')}
      </Button>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-small text-danger">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
