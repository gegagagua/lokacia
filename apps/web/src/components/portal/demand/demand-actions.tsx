'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, RefreshCw, Send, XCircle } from 'lucide-react';
import type { ListingCard } from '@lokacia/contracts';
import { Button, Field, Select, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';

/** Requester controls: close / renew. */
export function DemandOwnerActions({ id, status }: { id: string; status: 'active' | 'closed' | 'expired' }) {
  const t = useTranslations('demand.detail');
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<'close' | 'renew' | null>(null);
  const run = async (kind: 'close' | 'renew') => {
    setBusy(kind);
    try {
      await apiFetch(`/demand/${id}/${kind}`, { method: 'POST' });
      toast({ title: kind === 'close' ? t('closed') : t('renewed'), tone: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('close'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'active' && (
        <Button variant="danger" size="sm" loading={busy === 'close'} onClick={() => void run('close')} icon={<XCircle className="size-4" strokeWidth={1.5} aria-hidden />}>
          {t('close')}
        </Button>
      )}
      <Button variant="secondary" size="sm" loading={busy === 'renew'} onClick={() => void run('renew')} icon={<RefreshCw className="size-4" strokeWidth={1.5} aria-hidden />}>
        {t('renew')}
      </Button>
    </div>
  );
}

/** Owner/broker responds to a request; optional listing attachment. */
export function DemandContactForm({ id, loggedIn }: { id: string; loggedIn: boolean }) {
  const t = useTranslations('demand.contact');
  const [body, setBody] = React.useState('');
  const [listingId, setListingId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<string | null>(null);
  const mine = useSWR<(ListingCard & { status: string })[]>(loggedIn ? '/listings/mine' : null, fetcher, { shouldRetryOnError: false });
  const active = (mine.data ?? []).filter((l) => l.status === 'active');

  if (!loggedIn) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-h3 font-semibold">{t('title')}</h2>
        <p className="mt-1 text-small text-muted">{t('hint')}</p>
        <Button asChild className="mt-4">
          <Link href={`/login?next=${encodeURIComponent(`/demand/${id}`)}`}>{t('login')}</Link>
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-card border border-success bg-surface p-5" role="status">
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="size-5" strokeWidth={1.5} aria-hidden />
          {t('sent')}
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={`/account/messages?conversation=${sent}`}>{t('openChat')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        setError(null);
        try {
          const res = await apiFetch<{ conversationId: string }>(`/demand/${id}/contact`, { method: 'POST', body: { body, listingId: listingId || null } });
          setSent(res.conversationId);
        } catch (err) {
          const p = err instanceof ClientApiError ? err.problem : null;
          setError(p?.errors?.[0]?.message ?? p?.detail ?? p?.title ?? t('error'));
        } finally {
          setSending(false);
        }
      }}
    >
      <div>
        <h2 className="text-h3 font-semibold">{t('title')}</h2>
        <p className="mt-1 text-small text-muted">{t('hint')}</p>
      </div>
      <Field label={t('body')} required error={error ?? undefined}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('bodyPlaceholder')} minLength={5} maxLength={2000} required rows={4} />
      </Field>
      {active.length > 0 && (
        <Field label={t('listing')}>
          <Select value={listingId} onChange={(e) => setListingId(e.target.value)} placeholder={t('noListing')} options={active.map((l) => ({ value: l.id, label: l.title }))} />
        </Field>
      )}
      <Button type="submit" loading={sending} disabled={body.trim().length < 5} icon={<Send className="size-4" strokeWidth={1.5} aria-hidden />} className="self-start">
        {t('submit')}
      </Button>
    </form>
  );
}
