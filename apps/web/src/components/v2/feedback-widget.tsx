'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Angry, Frown, Laugh, Meh, MessageSquareHeart, Smile } from 'lucide-react';
import { Button, cn, Dialog, Field, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

const FACES = [Angry, Frown, Meh, Smile, Laugh] as const;

/** Phase 15: floating feedback button → POST /v1/feedback. */
export function FeedbackWidget() {
  const t = useTranslations('v2.feedback');
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState<string>('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (pathname?.startsWith('/checkout/mock')) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/feedback', { method: 'POST', body: { message, rating: rating ? Number(rating) : undefined, path: window.location.pathname, app: 'web' } });
      toast({ title: t('thanks'), tone: 'success' });
      setOpen(false);
      setMessage('');
      setRating('');
    } catch (err) {
      setError(err instanceof ClientApiError ? (err.problem?.errors?.[0]?.message ?? err.message) : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={t('title')}
      description={t('description')}
      trigger={
        <button
          type="button"
          aria-label={t('button')}
          className="glass group fixed right-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-border px-3 text-small font-semibold text-text shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:shadow-ring focus-visible:outline-none sm:px-4"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-contrast transition-transform group-hover:scale-105">
            <MessageSquareHeart className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="hidden pr-1 sm:inline" aria-hidden>
            {t('button')}
          </span>
        </button>
      }
    >
      <form id="feedback-form" onSubmit={submit} className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-3 text-[15px] font-semibold">{t('rating')}</legend>
          <div className="grid grid-cols-5 gap-2">
            {FACES.map((Face, i) => {
              const v = String(i + 1);
              const on = rating === v;
              return (
                <label
                  key={v}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-2xl border py-2.5 transition-all duration-200 has-[:focus-visible]:shadow-ring',
                    on ? 'border-primary bg-primary-soft shadow-sm' : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  <input type="radio" name="feedback-rating" aria-label={v} value={v} checked={on} onChange={() => setRating(v)} className="sr-only" />
                  <Face aria-hidden strokeWidth={2} className={cn('size-6 transition-transform', on ? 'scale-110 text-primary-soft-text' : 'text-muted')} />
                  <span className={cn('text-small font-semibold tabular', on ? 'text-primary-soft-text' : 'text-muted')}>{v}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label={t('message')} error={error} required>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} required />
        </Field>
        <Button type="submit" size="lg" loading={busy} disabled={message.trim().length < 3}>
          {t('send')}
        </Button>
      </form>
    </Dialog>
  );
}
