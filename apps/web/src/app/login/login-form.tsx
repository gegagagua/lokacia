'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { normalizePhone } from '@lokacia/contracts';
import { Button, Card, Field, Input } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';

const DEMO = [
  ['+995500000003', 'owner'],
  ['+995500000006', 'tenant'],
  ['+995500000004', 'agencyManager'],
  ['+995500000005', 'broker'],
  ['+995500000007', 'developer'],
  ['+995500000008', 'provider'],
  ['+995500000002', 'moderator'],
  ['+995500000001', 'admin'],
] as const;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const lp = useLocalizedPath();
  const { data: providers } = useSWR<{ google: boolean; otpDevCode: string | null }>('/auth/providers', fetcher);
  const [step, setStep] = React.useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const codeRef = React.useRef<HTMLInputElement>(null);

  const request = async (e?: React.FormEvent, overridePhone?: string) => {
    e?.preventDefault();
    const normalized = normalizePhone(overridePhone ?? phone);
    if (!normalized) return setError(t('invalidPhone'));
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone: normalized } });
      setPhone(normalized);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
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
      await apiFetch('/auth/otp/verify', { method: 'POST', body: { phone, code, name: name || undefined } });
      window.location.href = lp(next);
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
            <Input inputMode="tel" autoComplete="tel" placeholder={t('phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} prefixIcon={<span className="text-small">+995</span>} required />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {t('sendCode')}
          </Button>
          {providers?.google && (
            <Button asChild variant="secondary" size="lg">
              <a href="/api/v1/auth/google">{t('google')}</a>
            </Button>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <p className="text-small text-muted">{t('codeHint', { phone })}</p>
          {providers?.otpDevCode && <p className="rounded-button border border-accent bg-accent/15 px-3 py-2 text-small">{t('devCode', { code: providers.otpDevCode })}</p>}
          <Field label={t('code')} error={error}>
            <Input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="tabular tracking-[0.3em]" required />
          </Field>
          <Field label={t('name')}>
            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
            {t('verify')}
          </Button>
          <div className="flex justify-between text-small">
            <button type="button" className="text-link hover:underline" onClick={() => setStep('phone')}>
              {t('changePhone')}
            </button>
            <button type="button" className="text-link hover:underline" onClick={() => request()}>
              {t('resend')}
            </button>
          </div>
        </form>
      )}
      <p className="mt-6 text-small text-muted">{t('consent')}</p>
      {providers?.otpDevCode && step === 'phone' && (
        <details className="mt-6 rounded-card border border-border p-3">
          <summary className="cursor-pointer text-small font-medium">
            {t('demoAccounts')} · <span className="text-muted">{t('demoHint')}</span>
          </summary>
          <ul className="mt-2 flex flex-col">
            {DEMO.map(([p, label]) => (
              <li key={p}>
                <button
                  type="button"
                  className="flex w-full justify-between rounded-[6px] px-2 py-1.5 text-small hover:bg-surface-2"
                  onClick={() => {
                    setPhone(p);
                    void request(undefined, p).then(() => setCode(providers.otpDevCode ?? ''));
                  }}
                >
                  <span>{t(`demoRoles.${label}`)}</span>
                  <span className="tabular text-muted">{p}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
