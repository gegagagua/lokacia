'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { normalizePhone } from '@lokacia/contracts';
import { Button, Card, Field, Input } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

const DEMO = [
  ['+995500000004', 'manager'],
  ['+995500000005', 'agent'],
  ['+995500000009', 'assistant'],
  ['+995500000010', 'manager2'],
] as const;

/** CRM login reusing the portal OTP endpoints (auth cookies are shared across localhost ports / the parent domain). */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const { data: providers } = useSWR('/auth/providers', (p: string) => apiFetch<{ google: boolean; otpDevCode: string | null }>(p, { noOrg: true }));
  const [step, setStep] = React.useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const codeRef = React.useRef<HTMLInputElement>(null);

  const request = async (e?: React.FormEvent, overridePhone?: string) => {
    e?.preventDefault();
    const normalized = normalizePhone(overridePhone ?? phone);
    if (!normalized) return setError('ტელეფონის ნომერი არასწორია');
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone: normalized }, noOrg: true });
      setPhone(normalized);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'შეცდომა');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: React.FormEvent, overrideCode?: string, overridePhone?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/verify', { method: 'POST', body: { phone: overridePhone ?? phone, code: overrideCode ?? code }, noOrg: true });
      document.cookie = 'lk_org=; path=/; max-age=0';
      window.location.href = next;
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'შეცდომა');
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
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <p className="text-small text-muted">{t('codeHint', { phone })}</p>
          {providers?.otpDevCode && <p className="rounded-button border border-accent bg-accent/15 px-3 py-2 text-small">{t('devCode', { code: providers.otpDevCode })}</p>}
          <Field label={t('code')} error={error}>
            <Input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="tabular tracking-[0.3em]" required />
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
      {providers?.otpDevCode && step === 'phone' && (
        <div className="mt-6 rounded-card border border-border p-3">
          <p className="text-small font-medium">
            {t('demoAccounts')} · <span className="text-muted">{t('demoHint')}</span>
          </p>
          <ul className="mt-2 flex flex-col">
            {DEMO.map(([p, key]) => (
              <li key={p}>
                <button
                  type="button"
                  className="flex w-full justify-between rounded-[6px] px-2 py-1.5 text-small hover:bg-surface-2"
                  onClick={async () => {
                    setPhone(p);
                    await request(undefined, p);
                    await verify(undefined, providers.otpDevCode ?? '', p);
                  }}
                >
                  <span>{t(`demo.${key}`)}</span>
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
