'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { normalizePhone } from '@lokacia/contracts';
import { ArrowRight, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, Field, Input } from '@lokacia/ui';
import { PersonAvatar } from '@/components/common/ui';
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
    if (!normalized) return setError(t('invalidPhone'));
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/otp/request', { method: 'POST', body: { phone: normalized }, noOrg: true });
      setPhone(normalized);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t('genericError'));
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
      setError(err instanceof ClientApiError ? err.message : t('genericError'));
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[440px]">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text shadow-xs" aria-hidden>
        {step === 'phone' ? <Smartphone className="size-6" strokeWidth={2} /> : <MessageSquareText className="size-6" strokeWidth={2} />}
      </span>
      <h1 className="mt-5 text-[32px] font-bold leading-10 tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-[16px] text-muted">{t('subtitle')}</p>
      <div className="card mt-7 p-5 sm:p-6">
        {step === 'phone' ? (
          <form onSubmit={request} className="flex flex-col gap-4">
            <Field label={t('phone')} error={error}>
              <Input inputMode="tel" autoComplete="tel" placeholder={t('phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} prefixIcon={<span className="text-small font-medium">+995</span>} required />
            </Field>
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {t('sendCode')}
              {!busy && <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-4">
            <p className="text-small text-muted">{t('codeHint', { phone })}</p>
            {providers?.otpDevCode && <p className="rounded-xl bg-accent-soft px-3 py-2 text-small font-medium">{t('devCode', { code: providers.otpDevCode })}</p>}
            <Field label={t('code')} error={error}>
              <Input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-[22px] font-semibold tabular tracking-[0.5em]" required />
            </Field>
            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6} className="w-full">
              {t('verify')}
            </Button>
            <div className="flex justify-between gap-3 text-small">
              <button type="button" className="font-medium text-link hover:underline" onClick={() => setStep('phone')}>
                {t('changePhone')}
              </button>
              <button type="button" className="font-medium text-link hover:underline" onClick={() => request()}>
                {t('resend')}
              </button>
            </div>
          </form>
        )}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-muted">
          <ShieldCheck className="size-4 text-success" strokeWidth={2} aria-hidden />
          {t('secure')}
        </p>
      </div>
      {providers?.otpDevCode && step === 'phone' && (
        <div className="mt-6">
          <p className="text-[14px] font-semibold">
            {t('demoAccounts')} <span className="font-normal text-muted">· {t('demoHint')}</span>
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO.map(([p, key]) => (
              <li key={p}>
                <button
                  type="button"
                  disabled={busy}
                  className="group flex w-full items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-visible:shadow-ring focus-visible:outline-none disabled:opacity-60"
                  onClick={async () => {
                    setPhone(p);
                    await request(undefined, p);
                    await verify(undefined, providers.otpDevCode ?? '', p);
                  }}
                >
                  <PersonAvatar name={t(`demo.${key}`)} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold leading-4">{t(`demo.${key}`)}</span>
                    <span className="block truncate text-[12px] leading-4 text-muted tabular">{p}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
