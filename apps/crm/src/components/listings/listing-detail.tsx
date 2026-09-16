'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, Rss } from 'lucide-react';
import {
  BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, formatNumber, PASSPORT_FIELDS, relativeDaysKa, type ListingDetail,
} from '@lokacia/contracts';
import { Badge, Card, EmptyState, PriceTag, Skeleton, SpacePlan, SpecRow, Tabs } from '@lokacia/ui';
import { ActivityTimeline } from '@/components/common/timeline';
import { PageHeader } from '@/components/common/page-header';
import { CompetitorsTable } from '@/components/marketing/competitors-table';
import { useApi } from '@/lib/swr';
import { DescriptionEditor } from './description-editor';
import { ListingActions } from './listing-actions';
import { PhotosPanel } from './photos-panel';
import { Sparkline } from './sparkline';
import { ListingStatusBadge } from './status-badge';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
type Stats = { days: { day: string; views: number; reveals: number; saves: number }[]; total: { views: number; reveals: number; saves: number }; inFeed: boolean };

export function ListingDetailView({ id, tab }: { id: string; tab?: string }) {
  const t = useTranslations('listings');
  const { data: l, error, mutate } = useApi<ListingDetail & { canManage: boolean }>(`/listings/${id}?track=0`);
  const { data: stats, mutate: mutateStats } = useApi<Stats>(`/crm/listings/${id}/stats`);
  const [active, setActive] = React.useState(tab ?? 'overview');

  React.useEffect(() => {
    window.history.replaceState(null, '', active === 'overview' ? `/listings/${id}` : `/listings/${id}?tab=${active}`);
  }, [active, id]);

  if (error) return <EmptyState title={t('detail.notFound')} action={<Link href="/listings" className="text-link underline">{t('detail.back')}</Link>} />;
  if (!l) return <Skeleton className="h-96" />;

  const specs = PASSPORT_FIELDS.flatMap((f) => {
    const v = l.passport[f.key];
    if (v === null || v === undefined) return [];
    return [{ key: f.key, label: f.labelKa, value: typeof v === 'boolean' ? (v ? 'კი' : 'არა') : formatNumber(Number(v), f.kind === 'number' ? 1 : 0), unit: f.unit }];
  });
  const refresh = () => {
    void mutate();
    void mutateStats();
  };

  const overview = (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
          <SpacePlan areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} outline={l.passport.outline} />
          <div className="flex flex-col gap-1">
            <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.areaM2} size="lg" />
            <SpecRow label={t('detail.dealType')} value={DEAL_TYPE_LABELS_KA[l.dealType]} />
            <SpecRow label={t('columns.area')} value={formatArea(l.areaM2)} />
            <SpecRow label={t('detail.address')} value={`${l.address}${l.districtName ? `, ${l.districtName}` : ''}`} />
            {l.commissionPct !== null && <SpecRow label={t('detail.commission')} value={`${formatNumber(l.commissionPct, 1)}%`} />}
            <SpecRow label={t('detail.lastConfirmed')} value={l.lastConfirmedAt ? `${formatDateKa(l.lastConfirmedAt)} · ${relativeDaysKa(l.lastConfirmedAt)}` : t('detail.never')} />
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-[15px] font-semibold">{t('detail.specs')}</h2>
          {specs.length ? (
            <div className="grid gap-x-6 md:grid-cols-2">
              {specs.map((s) => (
                <SpecRow key={s.key} label={s.label} value={s.value} unit={s.unit} />
              ))}
            </div>
          ) : (
            <p className="text-small text-muted">—</p>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="text-[15px] font-semibold">{t('detail.stats30')}</h2>
          {stats ? (
            <>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(['views', 'reveals', 'saves'] as const).map((k) => (
                  <div key={k} className="rounded-button border border-border p-2">
                    <dt className="text-[11px] text-muted">{t(`detail.${k}`)}</dt>
                    <dd className="compact text-h3 font-semibold tabular">{formatNumber(stats.total[k])}</dd>
                  </div>
                ))}
              </dl>
              <Sparkline className="mt-3" values={stats.days.map((d) => d.views)} label={t('detail.views')} width={280} />
            </>
          ) : (
            <Skeleton className="mt-2 h-24" />
          )}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Rss className="size-4 text-link" strokeWidth={1.5} aria-hidden />
          <span className="text-small">{t('feed.title')}</span>
          <Badge tone={stats?.inFeed ? 'success' : 'outline'} className="ml-auto">
            {stats?.inFeed ? t('feed.inFeed') : t('feed.notInFeed')}
          </Badge>
        </Card>
        {l.businessTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {l.businessTypes.map((b) => (
              <Badge key={b} tone="neutral">
                {BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        back={
          <Link href="/listings" className="inline-flex items-center gap-1 text-muted hover:text-text">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('detail.back')}
          </Link>
        }
        title={l.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={l.status} />
            {l.address}
          </span>
        }
        actions={
          <>
            <ListingActions id={l.id} status={l.status} onChanged={refresh} />
            {['active', 'stale', 'rented', 'sold'].includes(l.status) && (
              <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border-strong px-3 text-small hover:bg-surface-2">
                <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
                {t('openPortal')}
              </a>
            )}
          </>
        }
      />
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
