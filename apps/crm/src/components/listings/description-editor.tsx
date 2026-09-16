'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { Badge, Button, Field, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';

type Texts = { ka: string; en: string; ru: string };

/** C11 text part: one click → ka/en/ru descriptions (AI or template fallback), editable before saving to the listing. */
export function DescriptionEditor({ listing, onSaved }: { listing: ListingDetail; onSaved: () => void }) {
  const t = useTranslations('listings.ai');
  const toast = useToast();
  const mutate = useApiMutation();
  const [texts, setTexts] = React.useState<Texts>({ ka: listing.description ?? '', en: listing.descriptionEn ?? '', ru: listing.descriptionRu ?? '' });
  const [source, setSource] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'gen' | 'save' | null>(null);
  const dirty = texts.ka !== (listing.description ?? '') || texts.en !== (listing.descriptionEn ?? '') || texts.ru !== (listing.descriptionRu ?? '');

  const generate = async () => {
    setBusy('gen');
    try {
      const r = await mutate<Texts & { source: string }>('/ai/describe', { body: { listingId: listing.id, locales: ['ka', 'en', 'ru'] } });
      setTexts({ ka: r.ka, en: r.en, ru: r.ru });
      setSource(r.source);
      toast({ title: t('generated'), description: r.source === 'ai' ? undefined : t('template'), tone: 'success' });
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      await mutate(`/listings/${listing.id}`, { method: 'PATCH', body: { description: texts.ka, descriptionEn: texts.en || null, descriptionRu: texts.ru || null } });
      toast({ title: t('saved'), tone: 'success' });
      onSaved();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-card border border-dashed border-border-strong p-3 sm:flex-row sm:items-center">
        <Sparkles className="size-4 text-accent" strokeWidth={1.5} aria-hidden />
        <p className="min-w-0 flex-1 text-small text-muted">{t('hint')}</p>
        {source && <Badge tone={source === 'ai' ? 'success' : 'outline'}>{source === 'ai' ? 'AI' : t('templateShort')}</Badge>}
        <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={generate} loading={busy === 'gen'} icon={<Sparkles className="size-3.5" strokeWidth={1.5} aria-hidden />}>
          {source ? t('regenerate') : t('generate')}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {(['ka', 'en', 'ru'] as const).map((l) => (
          <Field key={l} label={t(l)}>
            <Textarea value={texts[l]} onChange={(e) => setTexts((s) => ({ ...s, [l]: e.target.value }))} className="min-h-72 text-[14px]" lang={l} />
          </Field>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={busy === 'save'} disabled={!dirty || !texts.ka.trim()}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
