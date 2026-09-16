'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { normalizePhone } from '@lokacia/contracts';
import { ArrowLeft, ArrowRight, FlaskConical, Lock, MessageSquareText, Phone } from 'lucide-react';
import { Avatar, Button, Field, Input } from '@lokacia/ui';
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
    <div>
      <div className="eyebrow mb-4">
        <Lock className="size-3.5" strokeWidth={2} aria-hidden />
        {t('secure')}
      </div>
      <h1 className="text-[32px] font-bold leading-tight tracking-tight md:text-[36px]">{t('title')}</h1>
      <p className="mt-2 text-[16px] text-muted">{t('subtitle')}</p>
      <div className="card mt-8 p-6 md:p-7">
        {step === 'phone' ? (
          <form onSubmit={request} className="flex flex-col gap-5">
            <Field label={t('phone')} error={error}>
              <Input inputMode="tel" autoComplete="tel" placeholder="5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} prefixIcon={<Phone className="size-4" strokeWidth={2} aria-hidden />} required />
            </Field>
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {t('sendCode')}
              <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-[14.5px] text-primary-soft-text">
              <MessageSquareText className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              {t('codeHint', { phone })}
            </div>
            <Field label={t('code')} error={error}>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="h-14 text-center text-[24px] font-bold tabular tracking-[0.5em]" autoFocus required />
            </Field>
            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6} className="w-full">
              {t('verify')}
            </Button>
            <button type="button" className="inline-flex items-center gap-1.5 self-center text-[14.5px] font-semibold text-link hover:underline" onClick={() => setStep('phone')}>
              <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
              {t('changePhone')}
            </button>
          </form>
        )}
      </div>
      {step === 'phone' && (
        <div className="mt-5 rounded-card border border-dashed border-border-strong bg-surface/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-muted">
            <FlaskConical className="size-4" strokeWidth={2} aria-hidden />
            {t('demo')}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {DEMO.map(([p, role]) => (
              <li key={p}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-left shadow-xs ring-1 ring-inset ring-border transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:shadow-ring focus-visible:outline-none"
                  onClick={() => {
                    setPhone(p);
                    void request(undefined, p).then(() => setCode('123456'));
                  }}
                >
                  <Avatar name={t(`roles.${role}`)} size={32} className="ring-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{t(`roles.${role}`)}</span>
                    <span className="block text-[12.5px] text-muted tabular">{p}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
