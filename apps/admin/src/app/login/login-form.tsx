'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { normalizePhone } from '@lokacia/contracts';
import { Button, Card, Field, Input } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

const DEMO = [
  ['+995500000001', 'admin'],
  ['+995500000002', 'moderator'],
] as const;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const [step, setStep] = React.useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const request = async (e?: React.FormEvent, override?: string) => {
    e?.preventDefault();
    const normalized = normalizePhone(override ?? phone);
    if (!normalized) return setError(t('badPhone'));
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone: normalized } });
      setPhone(normalized);
      setStep('code');
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/verify', { method: 'POST', body: { phone, code } });
      window.location.href = next;
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t('error'));
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 md:p-8">
      <h1 className="text-h2 font-semibold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      {step === 'phone' ? (
        <form onSubmit={request} className="mt-6 flex flex-col gap-4">
          <Field label={t('phone')} error={error}>
            <Input inputMode="tel" autoComplete="tel" placeholder="5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <p className="text-small text-muted">{t('codeHint', { phone })}</p>
          <Field label={t('code')} error={error}>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="tabular tracking-[0.3em]" autoFocus required />
          </Field>
          <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
            {t('verify')}
          </Button>
          <button type="button" className="self-start text-small text-link hover:underline" onClick={() => setStep('phone')}>
            {t('changePhone')}
          </button>
        </form>
      )}
      {step === 'phone' && (
        <div className="mt-6 rounded-card border border-border p-3">
          <div className="text-small font-medium">{t('demo')}</div>
          <ul className="mt-2 flex flex-col">
            {DEMO.map(([p, role]) => (
              <li key={p}>
                <button
                  type="button"
                  className="flex w-full justify-between rounded-[6px] px-2 py-1.5 text-small hover:bg-surface-2"
                  onClick={() => {
                    setPhone(p);
                    void request(undefined, p).then(() => setCode('123456'));
                  }}
                >
                  <span>{t(`roles.${role}`)}</span>
                  <span className="tabular text-muted">{p}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
