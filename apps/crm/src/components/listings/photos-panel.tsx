'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { RotateCw, Wand2 } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { Button, EmptyState, Select, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';

type Media = ListingDetail['media'][number];

/** C11 image part: light/contrast normalization + mild sharpening + small tilt fix (POST /v1/media/:id/enhance). */
export function PhotosPanel({ listing, onChanged }: { listing: ListingDetail; onChanged: () => void }) {
  const t = useTranslations('listings.photos');
  const photos = listing.media.filter((m) => m.kind === 'photo' || m.kind === 'plan');
  if (!photos.length) return <EmptyState title={t('empty')} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 rounded-2xl bg-primary-soft/60 px-4 py-3 text-[13.5px] text-primary-soft-text"><Wand2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />{t('hint')}</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((m) => (
          <PhotoTile key={m.id} media={m} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}

function PhotoTile({ media, onChanged }: { media: Media; onChanged: () => void }) {
  const t = useTranslations('listings.photos');
  const toast = useToast();
  const mutate = useApiMutation();
  const [rotate, setRotate] = React.useState('0');
  const [busy, setBusy] = React.useState(false);
  const [before, setBefore] = React.useState<string | null>(null);
  const [after, setAfter] = React.useState<string | null>(null);
  const placeholder = media.url.includes('/media/placeholder/');
  const current = after ?? media.variants?.md ?? media.url;

  const enhance = async () => {
    setBusy(true);
    try {
      const prev = media.variants?.md ?? media.url;
      const row = await mutate<{ url: string }>(`/media/${media.id}/enhance`, { body: { rotateDeg: Number(rotate) } });
      setBefore(prev);
      setAfter(`${row.url}${row.url.includes('?') ? '&' : '?'}v=${Date.now()}`);
      toast({ title: t('enhanced'), tone: 'success' });
      onChanged();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card card-hover group flex flex-col overflow-hidden">
      {before ? (
        <div className="grid grid-cols-2 gap-px bg-border">
          <figure className="relative bg-surface-2">
            <img src={before} alt="" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="absolute left-2 top-2 rounded-full bg-surface/95 px-2.5 py-0.5 text-[12px] font-semibold shadow-sm">{t('before')}</figcaption>
          </figure>
          <figure className="relative bg-surface-2">
            <img src={current} alt={media.alt ?? ''} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-semibold text-primary-contrast shadow-sm">{t('after')}</figcaption>
          </figure>
        </div>
      ) : (
        <div className="overflow-hidden"><img src={current} alt={media.alt ?? ''} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" /></div>
      )}
      <div className="flex items-center gap-2 border-t border-border p-3">
        {placeholder ? (
          <p className="text-small text-muted">{t('placeholder')}</p>
        ) : (
          <>
            <label className="sr-only" htmlFor={`rot-${media.id}`}>
              {t('rotate')}
            </label>
            <RotateCw className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
            <Select id={`rot-${media.id}`} value={rotate} onChange={(e) => setRotate(e.target.value)} className="h-9 w-24 text-small" options={['-3', '-2', '-1', '0', '1', '2', '3'].map((v) => ({ value: v, label: `${v}°` }))} />
            <Button size="sm" className="ml-auto" onClick={enhance} loading={busy} icon={<Wand2 className="size-3.5" strokeWidth={2} aria-hidden />}>
              {busy ? t('enhancing') : t('enhance')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
