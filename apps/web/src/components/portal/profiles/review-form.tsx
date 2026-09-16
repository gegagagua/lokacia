'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Button, Card, Field, Textarea } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

/** "შეფასების დატოვება": 1–5 stars (radio group) + comment. `endpoint` is relative to /api/v1. */
export function ReviewForm({ endpoint }: { endpoint: string }) {
  const t = useTranslations('profiles.review');
  const router = useRouter();
  const pathname = usePathname();
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const name = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setMsg({ tone: 'err', text: t('rating') });
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(endpoint, { method: 'POST', body: { rating, body: body.trim() || null } });
      setMsg({ tone: 'ok', text: t('success') });
      setBody('');
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
      const status = err instanceof ClientApiError ? err.status : 0;
      setMsg({ tone: 'err', text: status === 409 ? t('already') : status === 400 ? t('own') : t('error') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="form" onSubmit={submit} className="flex flex-col gap-4 p-4">
      <h3 className="text-h3 font-semibold">{t('title')}</h3>
      <fieldset>
        <legend className="mb-1.5 text-small font-medium">{t('rating')}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-button p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <input type="radio" name={name} value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <span className="sr-only">{t('stars', { n })}</span>
              <Star className={`size-7 ${rating >= n ? 'fill-accent text-accent' : 'text-border-strong'}`} strokeWidth={1.5} aria-hidden />
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t('body')}>
        <Textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={t('bodyPlaceholder')} />
      </Field>
      <p aria-live="polite" className={`text-small ${msg?.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
        {msg?.text}
      </p>
      <Button type="submit" loading={busy} className="self-start">
        {t('submit')}
      </Button>
    </Card>
  );
}
