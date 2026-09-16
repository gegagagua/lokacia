'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleOff, Clock, LinkIcon, MapPin } from 'lucide-react';
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
    <article className="w-full max-w-lg overflow-hidden rounded-modal border border-border bg-surface shadow-lg">
      <div className="relative">
        {l.cover ? <img src={l.cover} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="drawing-grid aspect-[16/9] w-full bg-surface-2" aria-hidden />}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-2 rounded-full bg-surface/95 py-1 pl-3 pr-1 text-small shadow-md backdrop-blur">
          <span className="text-muted">{t('status')}</span>
          <ListingStatusBadge status={(done?.status ?? l.status) as ListingStatus} />
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6 sm:p-7">
        <div>
          <h1 className="text-[22px] font-bold leading-snug tracking-tight">{l.title}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-small text-muted">
            <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {l.address}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-small text-muted">
            <Clock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {l.lastConfirmedAt ? t('lastConfirmed', { when: f.relativeDays(l.lastConfirmedAt) }) : t('never')}
          </p>
        </div>

        <div aria-live="polite">
          {done ? (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-3 rounded-2xl bg-success/10 p-4 text-[15px] font-medium">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success text-white dark:text-bg" aria-hidden>
                  <CheckCircle2 className="size-5" strokeWidth={2} />
                </span>
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
              <h2 className="text-[26px] font-bold leading-8 tracking-tight">{t('title')}</h2>
              <p className="text-muted">{used ? t('alreadyDone') : t('description')}</p>
              <Button size="lg" className="w-full" loading={busy === 'available'} disabled={!!busy} onClick={() => answer('available')} icon={<CheckCircle2 className="size-5" strokeWidth={2} aria-hidden />}>
                {t('available')}
              </Button>
              <Button size="lg" variant="secondary" className="w-full" loading={busy === 'rented'} disabled={!!busy} onClick={() => answer('rented')} icon={<CircleOff className="size-5" strokeWidth={2} aria-hidden />}>
                {t('rented')}
              </Button>
              {error && (
                <p className="text-small text-danger" role="alert">
                  {error}
                </p>
              )}
              {info.check.result === 'pending' && (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-small text-muted">
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
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-modal border border-border bg-surface p-8 text-center shadow-lg" role="alert">
      <span className="grid size-16 place-items-center rounded-[22px] bg-accent-soft" aria-hidden>
        <LinkIcon className="size-7" strokeWidth={2} />
      </span>
      <h1 className="text-[22px] font-bold tracking-tight">{t('invalidTitle')}</h1>
      <p className="text-muted">{t('invalidDescription')}</p>
      <Button asChild>
        <Link href="/login?next=/account/listings">{t('login')}</Link>
      </Button>
    </div>
  );
}
