'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CheckCircle2, FileText } from 'lucide-react';
import type { FavoriteDto, ListingCard } from '@lokacia/contracts';
import { Button, Dialog, Field, Select, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useCategoryName } from './provider-card';

/** "ფასის მოთხოვნა" — request-a-quote dialog (P24). */
export function QuoteDialog({ providerId, providerSlug, categories, loggedIn }: { providerId: string; providerSlug: string; categories: string[]; loggedIn: boolean }) {
  const t = useTranslations('services.quote');
  const catName = useCategoryName();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState(categories[0] ?? '');
  const [description, setDescription] = React.useState('');
  const [listingId, setListingId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const mine = useSWR<ListingCard[]>(open && loggedIn ? '/listings/mine' : null, fetcher, { shouldRetryOnError: false });
  const favs = useSWR<FavoriteDto[]>(open && loggedIn ? '/favorites' : null, fetcher, { shouldRetryOnError: false });
  const listings = React.useMemo(() => {
    const seen = new Set<string>();
    return [...(mine.data ?? []), ...(favs.data ?? [])].filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  }, [mine.data, favs.data]);

  if (!loggedIn) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={`/login?next=${encodeURIComponent(`/services/${providerSlug}`)}`}>{t('login')}</Link>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSent(false);
          setError(null);
        }
      }}
      title={t('title')}
      description={t('description')}
      trigger={
        <Button size="lg" className="w-full" icon={<FileText className="size-4" strokeWidth={1.5} aria-hidden />}>
          {t('title')}
        </Button>
      }
    >
      {sent ? (
        <div className="flex flex-col items-start gap-3" role="status">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-5" strokeWidth={1.5} aria-hidden />
            {t('sent')}
          </p>
          <p className="text-muted">{t('sentHint')}</p>
          <Button asChild variant="secondary">
            <Link href="/account/services">{t('open')}</Link>
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            setError(null);
            try {
              await apiFetch('/services/orders', { method: 'POST', body: { providerId, category, description, listingId: listingId || null } });
              setSent(true);
              setDescription('');
              toast({ title: t('sent'), description: t('sentHint'), tone: 'success' });
            } catch (err) {
              const p = err instanceof ClientApiError ? err.problem : null;
              setError(p?.errors?.[0]?.message ?? p?.detail ?? p?.title ?? t('error'));
            } finally {
              setSending(false);
            }
          }}
        >
          <Field label={t('category')} required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} options={categories.map((c) => ({ value: c, label: catName(c) }))} />
          </Field>
          <Field label={t('details')} hint={t('detailsHint')} required error={error ?? undefined}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('detailsPlaceholder')} minLength={10} maxLength={3000} rows={5} required />
          </Field>
          {listings.length > 0 && (
            <Field label={t('listing')}>
              <Select value={listingId} onChange={(e) => setListingId(e.target.value)} placeholder={t('noListing')} options={listings.map((l) => ({ value: l.id, label: l.title }))} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={sending} disabled={description.trim().length < 10 || !category}>
              {t('submit')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
