'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronLeft, ChevronRight, ExternalLink, Maximize2, PlayCircle, Rotate3d } from 'lucide-react';
import type { MediaItem } from '@lokacia/contracts';
import { Button, Dialog, IconButton, cn } from '@lokacia/ui';

type Tab = 'photos' | 'plans' | 'pano' | 'video';

const src = (m: MediaItem, size: 'lg' | 'md' = 'lg') => m.variants?.[size] ?? m.variants?.md ?? m.url;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/** Listing gallery: photo / floor plan / 360° / video tabs, keyboard lightbox. First photo is the LCP element. */
export function ListingGallery({ media, title, videoUrl, tourUrl }: { media: MediaItem[]; title: string; videoUrl: string | null; tourUrl: string | null }) {
  const t = useTranslations('listing.gallery');
  const photos = media.filter((m) => m.kind === 'photo' && !m.isFloorplan);
  const plans = media.filter((m) => m.kind === 'plan' || m.isFloorplan);
  const panos = media.filter((m) => m.kind === 'pano360');
  const videos = media.filter((m) => m.kind === 'video');
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'photos' as const, label: t('photos'), count: photos.length },
    { key: 'plans' as const, label: t('plans'), count: plans.length },
    { key: 'pano' as const, label: t('pano'), count: panos.length + (tourUrl ? 1 : 0) },
    { key: 'video' as const, label: t('video'), count: videos.length + (videoUrl ? 1 : 0) },
  ].filter((x) => x.count > 0);
  const [tab, setTab] = React.useState<Tab>(tabs[0]?.key ?? 'photos');
  const [open, setOpen] = React.useState<number | null>(null);
  const items = tab === 'plans' ? plans : tab === 'pano' ? panos : photos;

  const move = React.useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  if (!tabs.length) {
    return (
      <div className="drawing-grid grid aspect-[16/9] place-items-center rounded-card border border-border bg-surface-2 text-muted">
        <div className="flex flex-col items-center gap-2">
          <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
          <span className="text-small">{t('empty')}</span>
        </div>
      </div>
    );
  }

  return (
    <section aria-label={t('label')} className="flex flex-col gap-3">
      {tabs.length > 1 && (
        <div role="tablist" aria-label={t('label')} className="flex flex-wrap gap-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={cn('h-8 rounded-button border px-3 text-small transition-colors duration-150', tab === x.key ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:bg-surface-2')}
            >
              {x.label} <span className="tabular opacity-70">{x.count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'video' ? (
        <div className="flex flex-col gap-3">
          {videoUrl &&
            (youtubeId(videoUrl) ? (
              <div className="aspect-video overflow-hidden rounded-photo border border-border bg-surface-2">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId(videoUrl)}`}
                  title={t('videoTitle')}
                  className="size-full"
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <Button asChild variant="secondary" icon={<PlayCircle className="size-4" strokeWidth={1.5} aria-hidden />}>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  {t('openVideo')}
                </a>
              </Button>
            ))}
          {videos.map((v) => (
            <video key={v.id} src={v.url} controls preload="metadata" className="w-full rounded-photo border border-border bg-surface-2">
              <track kind="captions" />
            </video>
          ))}
        </div>
      ) : (
        <>
          {tab === 'pano' && tourUrl && (
            <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
              <span className="flex items-center gap-2 text-[15px]">
                <Rotate3d className="size-5 text-link" strokeWidth={1.5} aria-hidden />
                {t('tour')}
              </span>
              <Button asChild size="sm" variant="secondary" icon={<ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />}>
                <a href={tourUrl} target="_blank" rel="noopener noreferrer">
                  {t('openTour')}
                </a>
              </Button>
            </div>
          )}
          {items.length > 0 && (
            <div className="grid grid-cols-4 grid-rows-2 gap-2">
              {items.slice(0, 5).map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={t('open', { n: i + 1, total: items.length })}
                  className={cn(
                    'group relative overflow-hidden rounded-photo border border-border bg-surface-2',
                    i === 0 ? 'col-span-4 row-span-2 aspect-[16/10] sm:col-span-2' : 'hidden aspect-[4/3] sm:block',
                    tab === 'plans' && 'bg-surface',
                  )}
                >
                  <img
                    src={src(m, i === 0 ? 'lg' : 'md')}
                    alt={m.alt ?? `${title} — ${i + 1}`}
                    loading={i === 0 && tab === 'photos' ? 'eager' : 'lazy'}
                    {...(i === 0 && tab === 'photos' ? { fetchPriority: 'high' as const } : {})}
                    decoding="async"
                    width={m.width ?? undefined}
                    height={m.height ?? undefined}
                    className={cn('absolute inset-0 size-full', tab === 'plans' ? 'object-contain p-2' : 'object-cover')}
                  />
                  {i === 4 && items.length > 5 && (
                    <span className="absolute inset-0 grid place-items-center bg-basalt/60 text-h3 font-semibold text-plaster tabular">+{items.length - 5}</span>
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[4px] bg-basalt/80 px-2 py-1 text-[12px] text-plaster tabular">
                      <Maximize2 className="size-3" strokeWidth={1.5} aria-hidden />
                      {t('counter', { n: 1, total: items.length })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={title} size="xl">
        {open !== null && items[open] && (
          <div
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1);
              if (e.key === 'ArrowLeft') move(-1);
            }}
          >
            <div className="relative grid place-items-center overflow-hidden rounded-photo bg-surface-2">
              <img src={src(items[open])} alt={items[open].alt ?? `${title} — ${open + 1}`} className="max-h-[70dvh] w-full object-contain" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <IconButton label={t('prev')} onClick={() => move(-1)} disabled={items.length < 2}>
                <ChevronLeft className="size-5" strokeWidth={1.5} />
              </IconButton>
              <span className="text-small text-muted tabular" aria-live="polite">
                {t('counter', { n: open + 1, total: items.length })}
              </span>
              <IconButton label={t('next')} onClick={() => move(1)} disabled={items.length < 2}>
                <ChevronRight className="size-5" strokeWidth={1.5} />
              </IconButton>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
