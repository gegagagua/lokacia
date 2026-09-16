'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Camera, ChevronLeft, ChevronRight, ExternalLink, Grid2x2, PlayCircle, Rotate3d } from 'lucide-react';
import type { MediaItem } from '@lokacia/contracts';
import { Button, Dialog, IconButton, cn } from '@lokacia/ui';

type Tab = 'photos' | 'plans' | 'pano' | 'video';

const src = (m: MediaItem, size: 'lg' | 'md' = 'lg') => m.variants?.[size] ?? m.variants?.md ?? m.url;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/** Mosaic cell spans for 1–5 tiles on a 4×2 grid (first tile is always the large 2×2 hero). */
function span(i: number, n: number) {
  if (i === 0) return n === 1 ? 'col-span-4 row-span-2' : 'col-span-2 row-span-2';
  if (n === 2) return 'col-span-2 row-span-2';
  if (n === 3) return 'col-span-2';
  if (n === 4) return i === 1 ? 'col-span-2' : '';
  return '';
}

/** Listing gallery v2: photo mosaic (1 large + 4), mobile swipe carousel, media tabs, lightbox with thumbnails. First photo is the LCP element. */
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
  const scroller = React.useRef<HTMLDivElement>(null);
  const [slide, setSlide] = React.useState(0);

  const move = React.useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  if (!tabs.length) {
    return (
      <div className="drawing-grid grid aspect-[16/9] max-h-[420px] w-full place-items-center rounded-card border border-border text-muted">
        <div className="flex flex-col items-center gap-3">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">
            <Building2 className="size-6" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-[15px] font-medium">{t('empty')}</span>
        </div>
      </div>
    );
  }

  const n = Math.min(items.length, 5);
  const contain = tab === 'plans';

  return (
    <section aria-label={t('label')} className="flex flex-col gap-3">
      {tabs.length > 1 && (
        <div role="tablist" aria-label={t('label')} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-surface-2 p-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => {
                setTab(x.key);
                setSlide(0);
              }}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                tab === x.key ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {x.label}
              <span className={cn('rounded-full px-1.5 text-[12px] tabular', tab === x.key ? 'bg-primary-soft text-primary-soft-text' : 'bg-surface-3')}>{x.count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'video' ? (
        <div className="flex flex-col gap-3">
          {videoUrl &&
            (youtubeId(videoUrl) ? (
              <div className="aspect-video overflow-hidden rounded-card border border-border bg-surface-2 shadow-sm">
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
              <Button asChild variant="secondary" icon={<PlayCircle className="size-4" strokeWidth={2} aria-hidden />} className="self-start">
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  {t('openVideo')}
                </a>
              </Button>
            ))}
          {videos.map((v) => (
            <video key={v.id} src={v.url} controls preload="metadata" className="w-full rounded-card border border-border bg-surface-2">
              <track kind="captions" />
            </video>
          ))}
        </div>
      ) : (
        <>
          {tab === 'pano' && tourUrl && (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="flex items-center gap-3 text-[15px] font-medium">
                <span className="grid size-10 place-items-center rounded-xl bg-link/10 text-link">
                  <Rotate3d className="size-5" strokeWidth={2} aria-hidden />
                </span>
                {t('tour')}
              </span>
              <Button asChild size="sm" variant="secondary" icon={<ExternalLink className="size-4" strokeWidth={2} aria-hidden />}>
                <a href={tourUrl} target="_blank" rel="noopener noreferrer">
                  {t('openTour')}
                </a>
              </Button>
            </div>
          )}
          {items.length > 0 && (
            <div className="relative">
              {/* Mobile: swipe carousel */}
              <div
                ref={scroller}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                }}
                className="-mx-4 flex w-[calc(100%+32px)] max-w-none snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
              >
                {items.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-label={t('open', { n: i + 1, total: items.length })}
                    className={cn('relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-surface-2', contain && 'bg-surface')}
                  >
                    <img
                      src={src(m, 'md')}
                      alt={m.alt ?? `${title} — ${i + 1}`}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                      decoding="async"
                      width={m.width ?? undefined}
                      height={m.height ?? undefined}
                      className={cn('absolute inset-0 size-full', contain ? 'object-contain p-3' : 'object-cover')}
                    />
                  </button>
                ))}
              </div>
              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12.5px] font-semibold text-white tabular backdrop-blur sm:hidden">
                <Camera className="size-3.5" strokeWidth={2} aria-hidden />
                {t('counter', { n: Math.min(slide + 1, items.length), total: items.length })}
              </span>

              {/* ≥ sm: mosaic */}
              <div className="hidden h-[340px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card sm:grid md:h-[420px] lg:h-[480px]">
                {items.slice(0, 5).map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-label={t('open', { n: i + 1, total: items.length })}
                    className={cn('group relative min-h-0 overflow-hidden bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none', span(i, n), contain && 'bg-surface')}
                  >
                    <img
                      src={src(m, 'md')}
                      srcSet={i === 0 && m.variants?.lg ? `${src(m, 'md')} 960w, ${m.variants.lg} 1600w` : undefined}
                      sizes={i === 0 ? '(min-width: 1024px) 640px, 50vw' : undefined}
                      alt={m.alt ?? `${title} — ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      width={m.width ?? undefined}
                      height={m.height ?? undefined}
                      className={cn('absolute inset-0 size-full transition-transform duration-500 ease-out group-hover:scale-[1.04]', contain ? 'object-contain p-3' : 'object-cover')}
                    />
                    <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(0)}
                icon={<Grid2x2 className="size-4" strokeWidth={2} aria-hidden />}
                className="absolute bottom-4 right-4 hidden border-white/60 bg-white/90 text-basalt shadow-md backdrop-blur hover:bg-white sm:inline-flex"
              >
                {t('showAll', { total: items.length })}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={title} description={open !== null ? t('counter', { n: open + 1, total: items.length }) : undefined} size="xl">
        {open !== null && items[open] && (
          <div
            className="flex flex-col gap-4"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1);
              if (e.key === 'ArrowLeft') move(-1);
            }}
          >
            <div className="relative grid place-items-center overflow-hidden rounded-photo bg-surface-2">
              <img src={src(items[open])} alt={items[open].alt ?? `${title} — ${open + 1}`} className="max-h-[62dvh] w-full object-contain" />
              {items.length > 1 && (
                <>
                  <IconButton label={t('prev')} onClick={() => move(-1)} variant="secondary" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full shadow-md">
                    <ChevronLeft className="size-5" strokeWidth={2} />
                  </IconButton>
                  <IconButton label={t('next')} onClick={() => move(1)} variant="secondary" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full shadow-md">
                    <ChevronRight className="size-5" strokeWidth={2} />
                  </IconButton>
                </>
              )}
            </div>
            {items.length > 1 && (
              <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t('label')}>
                {items.map((m, i) => (
                  <li key={m.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      aria-label={t('open', { n: i + 1, total: items.length })}
                      aria-current={i === open}
                      className={cn('relative block h-16 w-24 overflow-hidden rounded-xl bg-surface-2 ring-2 ring-offset-2 ring-offset-surface transition-all', i === open ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')}
                    >
                      <img src={src(m, 'md')} alt="" loading="lazy" className={cn('absolute inset-0 size-full', contain ? 'object-contain' : 'object-cover')} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <span className="sr-only" aria-live="polite">
              {t('counter', { n: open + 1, total: items.length })}
            </span>
          </div>
        )}
      </Dialog>
    </section>
  );
}
