'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { formatMoney, formatNumber, type ListingCard } from '@lokacia/contracts';
import { Button, Dialog, Field, Input, Select, Textarea } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

/** P8 pre-booking request for an off-plan project. */
export function PrebookDialog({ projectSlug, units, defaultUnitId, size = 'lg', className }: { projectSlug: string; units: ListingCard[]; defaultUnitId?: string; size?: 'md' | 'lg'; className?: string }) {
  const t = useTranslations('projects.prebook');
  const router = useRouter();
  const pathname = usePathname();
  const available = units.filter((u) => u.status === 'active');
  const [open, setOpen] = React.useState(false);
  const [unitId, setUnitId] = React.useState(defaultUnitId ?? '');
  const [message, setMessage] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<'ok' | 'duplicate' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ duplicate: boolean }>(`/projects/${projectSlug}/prebook`, {
        method: 'POST',
        body: { listingId: unitId || null, message: message.trim() || null, phone: phone.trim() || null },
      });
      setResult(r.duplicate ? 'duplicate' : 'ok');
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(err instanceof ClientApiError ? (err.problem?.detail ?? err.problem?.title ?? t('error')) : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
      title={t('title')}
      description={result ? undefined : t('description')}
      trigger={
        <Button size={size} className={className}>
          {t('cta')}
        </Button>
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="size-10 text-success" strokeWidth={1.5} aria-hidden />
          <p className="text-h3 font-semibold">{result === 'ok' ? t('success') : t('duplicate')}</p>
          <p className="text-muted">{result === 'ok' ? t('successHint') : t('duplicateHint')}</p>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('unit')}>
            <Select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              placeholder={t('anyUnit')}
              options={available.map((u) => ({ value: u.id, label: `${u.floor != null ? `${u.floor} ქ. · ` : ''}${formatNumber(u.areaM2)} მ² · ${formatMoney(u.priceMinor, u.currency)}` }))}
            />
          </Field>
          <Field label={t('message')}>
            <Textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder={t('messagePlaceholder')} />
          </Field>
          <Field label={t('phone')} hint={t('phoneHint')}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} placeholder="+995 5XX XX XX XX" />
          </Field>
          <p aria-live="assertive" className="text-small text-danger">
            {error}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('submit')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
