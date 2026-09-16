'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import { Button, Dialog, Field, RadioGroup, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

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
          className="fixed right-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-small font-medium text-text transition-colors hover:bg-surface-2"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <MessageSquare className="size-4" strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">{t('button')}</span>
          <span className="sr-only sm:hidden">{t('button')}</span>
        </button>
      }
    >
      <form id="feedback-form" onSubmit={submit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-[15px] font-medium">{t('rating')}</legend>
          <RadioGroup value={rating} onValueChange={setRating} className="flex-row flex-wrap gap-4" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} />
        </fieldset>
        <Field label={t('message')} error={error} required>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} required />
        </Field>
        <Button type="submit" loading={busy} disabled={message.trim().length < 3}>
          {t('send')}
        </Button>
      </form>
    </Dialog>
  );
}
