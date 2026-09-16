'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleOff, LinkIcon } from 'lucide-react';
import type { ListingStatus, LivenessCheckInfo } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { ListingStatusBadge } from '../status-badges';

export function ConfirmLiveness({ info, token }: { info: LivenessCheckInfo; token: string }) {
  const t = useTranslations('myListings.confirm');
  const f = useFormat();
  const l = info.listing;
  const [busy, setBusy] = React.useState<null | 'available' | 'rented'>(null);
  const [done, setDone] = React.useState<null | { status: string; answer: 'available' | 'rented' }>(null);
  const [error, setError] = React.useState<string | null>(null);
  const used = info.check.result !== 'pending' && info.check.result !== 'expired';

  const answer = async (a: 'available' | 'rented') => {
    setBusy(a);
    setError(null);
    try {
      const r = await apiFetch<{ status: string }>(`/listings/${l.id}/confirm`, { method: 'POST', body: { token, answer: a } });
      setDone({ status: r.status, answer: a });
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : t('error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="w-full max-w-md overflow-hidden rounded-card border border-border bg-surface">
      {l.cover ? <img src={l.cover} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="drawing-grid aspect-[16/9] w-full bg-surface-2" aria-hidden />}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-small text-muted">
            <span>{t('status')}:</span>
            <ListingStatusBadge status={(done?.status ?? l.status) as ListingStatus} />
          </div>
          <h1 className="text-h3 font-semibold leading-snug">{l.title}</h1>
          <p className="mt-1 text-small text-muted">{l.address}</p>
          <p className="mt-1 text-small text-muted">{l.lastConfirmedAt ? t('lastConfirmed', { when: f.relativeDays(l.lastConfirmedAt) }) : t('never')}</p>
        </div>

        <div aria-live="polite">
          {done ? (
            <div className="flex flex-col gap-4">
              <p className="flex items-start gap-2 rounded-button border border-success/30 bg-success/10 p-3 text-[15px]">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
                {done.answer === 'available' ? t('doneAvailable') : t('doneRented')}
              </p>
              <div className="flex flex-wrap gap-2">
                {done.answer === 'available' && (
                  <Button asChild variant="secondary">
                    <Link href={`/listings/${l.slug}`}>{t('openListing')}</Link>
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <Link href="/account/listings">{t('myListings')}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h2 className="compact text-h2 font-semibold">{t('title')}</h2>
              <p className="text-muted">{used ? t('alreadyDone') : t('description')}</p>
              <Button size="lg" className="w-full" loading={busy === 'available'} disabled={!!busy} onClick={() => answer('available')} icon={<CheckCircle2 className="size-5" strokeWidth={1.5} aria-hidden />}>
                {t('available')}
              </Button>
              <Button size="lg" variant="secondary" className="w-full" loading={busy === 'rented'} disabled={!!busy} onClick={() => answer('rented')} icon={<CircleOff className="size-5" strokeWidth={1.5} aria-hidden />}>
                {t('rented')}
              </Button>
              {error && (
                <p className="text-small text-danger" role="alert">
                  {error}
                </p>
              )}
              {info.check.result === 'pending' && (
                <p className="text-small text-muted">
                  {t('expiresAt', { date: f.dateTime(info.check.expiresAt) })}. {t('hiddenNote')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ConfirmInvalid() {
  const t = useTranslations('myListings.confirm');
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center" role="alert">
      <LinkIcon className="size-8 text-muted" strokeWidth={1.5} aria-hidden />
      <h1 className="text-h3 font-semibold">{t('invalidTitle')}</h1>
      <p className="text-muted">{t('invalidDescription')}</p>
      <Button asChild>
        <Link href="/login?next=/account/listings">{t('login')}</Link>
      </Button>
    </div>
  );
}
