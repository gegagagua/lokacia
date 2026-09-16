'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bookmark, Building2, CalendarCheck, ExternalLink, Eye, Handshake, Images, MapPin, Percent, Phone, Rss, Ruler, Tag } from 'lucide-react';
import {
  BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, formatNumber, PASSPORT_FIELDS, relativeDaysKa, type ListingDetail,
} from '@lokacia/contracts';
import { EmptyState, PriceTag, Skeleton, SpacePlan, Tabs, VipBadge } from '@lokacia/ui';
import { ActivityTimeline } from '@/components/common/timeline';
import { PageHeader } from '@/components/common/page-header';
import { IconTile, Pill, PersonAvatar, SectionCard, type Tone } from '@/components/common/ui';
import { CompetitorsTable } from '@/components/marketing/competitors-table';
import { useApi } from '@/lib/swr';
import { DescriptionEditor } from './description-editor';
import { ListingActions } from './listing-actions';
import { PhotosPanel } from './photos-panel';
import { Sparkline } from './sparkline';
import { ListingStatusBadge } from './status-badge';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
type Stats = { days: { day: string; views: number; reveals: number; saves: number }[]; total: { views: number; reveals: number; saves: number }; inFeed: boolean };

function Gallery({ listing, onAll }: { listing: ListingDetail; onAll: () => void }) {
  const t = useTranslations('listings');
  const photos = listing.media.filter((m) => m.kind === 'photo');
  const src = (m: (typeof photos)[number]) => m.variants?.md ?? m.url;
  if (!photos.length)
    return (
      <div className="drawing-grid grid aspect-[21/9] place-items-center rounded-card border border-border text-muted">
        <Building2 className="size-12" strokeWidth={1.5} aria-hidden />
      </div>
    );
  const [main, ...rest] = photos;
  const thumbs = rest.slice(0, 4);
  return (
    <div className="relative grid h-[240px] gap-2 overflow-hidden rounded-card sm:h-[340px] md:grid-cols-4 md:grid-rows-2 lg:h-[400px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(main!)} alt={main!.alt ?? listing.title} className={`size-full object-cover ${thumbs.length ? 'md:col-span-2 md:row-span-2' : 'md:col-span-4 md:row-span-2'}`} />
      {thumbs.map((m, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.id} src={src(m)} alt={m.alt ?? ''} loading="lazy" className={`hidden size-full object-cover md:block ${thumbs.length === 1 ? 'md:col-span-2 md:row-span-2' : thumbs.length === 2 ? 'md:row-span-2' : thumbs.length === 3 && i === 0 ? 'md:row-span-2' : ''}`} />
      ))}
      <div className="absolute left-3 top-3 flex gap-1.5">
        <ListingStatusBadge status={listing.status} overlay />
        {listing.vip && <VipBadge />}
      </div>
      <button type="button" onClick={onAll} className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-full bg-surface/95 px-3.5 text-[13.5px] font-semibold text-text shadow-md backdrop-blur transition-transform hover:-translate-y-0.5">
        <Images className="size-4" strokeWidth={2} aria-hidden />
        {t('detail.allPhotos', { count: photos.length })}
      </button>
    </div>
  );
}

function Fact({ icon, tone, label, value }: { icon: typeof Tag; tone: Tone; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <div className="text-[12.5px] leading-4 text-muted">{label}</div>
        <div className="truncate text-[14.5px] font-semibold leading-5">{value}</div>
      </div>
    </div>
  );
}

export function ListingDetailView({ id, tab }: { id: string; tab?: string }) {
  const t = useTranslations('listings');
  const { data: l, error, mutate } = useApi<ListingDetail & { canManage: boolean }>(`/listings/${id}?track=0`);
  const { data: stats, mutate: mutateStats } = useApi<Stats>(`/crm/listings/${id}/stats`);
  const [active, setActive] = React.useState(tab ?? 'overview');

  React.useEffect(() => {
    window.history.replaceState(null, '', active === 'overview' ? `/listings/${id}` : `/listings/${id}?tab=${active}`);
  }, [active, id]);

  if (error) return <EmptyState title={t('detail.notFound')} action={<Link href="/listings" className="text-link underline">{t('detail.back')}</Link>} />;
  if (!l)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-[400px] rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );

  const specs = PASSPORT_FIELDS.flatMap((f) => {
    const v = l.passport[f.key];
    if (v === null || v === undefined) return [];
    return [{ key: f.key, label: f.labelKa, value: typeof v === 'boolean' ? (v ? 'კი' : 'არა') : formatNumber(Number(v), f.kind === 'number' ? 1 : 0), unit: f.unit }];
  });
  const refresh = () => {
    void mutate();
    void mutateStats();
  };

  const metric = [
    { k: 'views' as const, icon: Eye, tone: 2 as Tone },
    { k: 'reveals' as const, icon: Phone, tone: 1 as Tone },
    { k: 'saves' as const, icon: Bookmark, tone: 5 as Tone },
  ];

  const overview = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="card p-4 md:p-5" aria-label={t('columns.price')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.areaM2} size="lg" />
            <Pill tone={1} icon={Handshake}>
              {DEAL_TYPE_LABELS_KA[l.dealType]}
            </Pill>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <Fact icon={Ruler} tone={2} label={t('columns.area')} value={formatArea(l.areaM2)} />
            <Fact icon={MapPin} tone={7} label={t('detail.address')} value={`${l.address}${l.districtName ? `, ${l.districtName}` : ''}`} />
            {l.commissionPct !== null && <Fact icon={Percent} tone={4} label={t('detail.commission')} value={`${formatNumber(l.commissionPct, 1)}%`} />}
            <Fact icon={CalendarCheck} tone={l.lastConfirmedAt ? 'success' : 'danger'} label={t('detail.lastConfirmed')} value={l.lastConfirmedAt ? `${formatDateKa(l.lastConfirmedAt)} · ${relativeDaysKa(l.lastConfirmedAt)}` : t('detail.never')} />
          </div>
        </section>
        <SectionCard title={t('detail.specs')} icon={Tag} tone={3}>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border bg-surface-2 p-3">
              <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} outline={l.passport.outline} />
            </div>
            {specs.length ? (
              <dl className="grid content-start gap-2 sm:grid-cols-2">
                {specs.map((s) => (
                  <div key={s.key} className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                    <dt className="min-w-0 truncate text-[13.5px] text-muted">{s.label}</dt>
                    <dd className="shrink-0 font-semibold tabular">
                      {s.value}
                      {s.unit && <span className="ml-1 text-[12.5px] font-normal text-muted">{s.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-small text-muted">—</p>
            )}
          </div>
        </SectionCard>
      </div>
      <aside className="flex min-w-0 flex-col gap-5">
        <SectionCard title={t('detail.stats30')} icon={Eye} tone={2}>
          {stats ? (
            <>
              <dl className="grid grid-cols-3 gap-2">
                {metric.map(({ k, icon: Icon, tone }) => (
                  <div key={k} className="rounded-2xl bg-surface-2 p-2.5 text-center">
                    <dt className="flex items-center justify-center gap-1 text-[12px] leading-4 text-muted">
                      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                      <span className="truncate">{t(`detail.${k}`)}</span>
                    </dt>
                    <dd className={`mt-1 text-[22px] font-bold leading-7 tracking-tight tabular tone-${tone} text-tone-ink`}>{formatNumber(stats.total[k])}</dd>
                  </div>
                ))}
              </dl>
              <Sparkline className="mt-4" values={stats.days.map((d) => d.views)} label={t('detail.views')} width={300} height={64} color="var(--tone-2)" />
            </>
          ) : (
            <Skeleton className="h-32" />
          )}
        </SectionCard>
        <div className="card flex items-center gap-3 p-4">
          <IconTile icon={Rss} tone={7} size="sm" />
          <span className="min-w-0 flex-1 text-[14px] font-medium">{t('feed.title')}</span>
          <Pill tone={stats?.inFeed ? 'success' : 'neutral'} dot>
            {stats?.inFeed ? t('feed.inFeed') : t('feed.notInFeed')}
          </Pill>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <PersonAvatar name={l.contact.name} src={l.contact.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{l.contact.name}</div>
            {l.contact.orgName && <div className="truncate text-[13px] text-muted">{l.contact.orgName}</div>}
          </div>
        </div>
        {l.businessTypes.length > 0 && (
          <SectionCard title={t('detail.businessTypes')} bodyClassName="pt-3">
            <div className="flex flex-wrap gap-1.5">
              {l.businessTypes.map((b) => (
                <Pill key={b} tone="neutral">
                  {BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b}
                </Pill>
              ))}
            </div>
          </SectionCard>
        )}
      </aside>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        icon={null}
        back={
          <Link href="/listings">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            {t('detail.back')}
          </Link>
        }
        title={l.title}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {l.address}
            {l.districtName ? `, ${l.districtName}` : ''}
          </span>
        }
        actions={
          <>
            <ListingActions id={l.id} status={l.status} onChanged={refresh} />
            {['active', 'stale', 'rented', 'sold'].includes(l.status) && (
              <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-button border border-border bg-surface px-3.5 text-[14px] font-semibold shadow-xs transition-colors hover:border-border-strong hover:bg-surface-2">
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                {t('openPortal')}
              </a>
            )}
          </>
        }
      />
      <Gallery listing={l} onAll={() => setActive('photos')} />
      <Tabs
        value={active}
        onValueChange={setActive}
        tabs={[
          { value: 'overview', label: t('detail.tabs.overview'), content: overview },
          { value: 'description', label: t('detail.tabs.description'), content: <DescriptionEditor key={l.updatedAt} listing={l} onSaved={refresh} /> },
          { value: 'photos', label: t('detail.tabs.photos'), count: l.media.filter((m) => m.kind === 'photo').length, content: <PhotosPanel listing={l} onChanged={refresh} /> },
          { value: 'competitors', label: t('detail.tabs.competitors'), content: <CompetitorsTable listingId={l.id} /> },
          { value: 'history', label: t('detail.tabs.history'), content: <ActivityTimeline entity="listing" entityId={l.id} canAdd={false} /> },
        ]}
      />
    </div>
  );
}
