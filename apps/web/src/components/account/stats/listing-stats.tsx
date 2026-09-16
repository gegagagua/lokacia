'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, Eye, FileSignature, Heart, Lightbulb, LineChart, MapPinned, Pencil, Percent, Phone, Scale, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { type AdviceItem, type ListingStatsDto, type StatsTotals } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { AccountPageHeader } from '../page-header';
import { ListingStatusBadge } from '../status-badges';
import { BarChart } from './bar-chart';
import { IconTile, KpiCard, SectionCard, Segmented, Trend, type Tone } from '../ui';

const PERIODS = [7, 30, 90] as const;

export function ListingStats({ listingId, initial }: { listingId: string; initial: ListingStatsDto }) {
  const t = useTranslations('stats');
  const [days, setDays] = React.useState<number>(30);
  const { data = initial, isValidating } = useSWR<ListingStatsDto>(`/stats/listings/${listingId}?days=${days}`, fetcher, { fallbackData: days === 30 ? initial : undefined, keepPreviousData: true });
  const l = data.listing;

  return (
    <div>
      <AccountPageHeader
        back={
          <Link href="/account/listings" className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-muted shadow-xs ring-1 ring-border transition-colors hover:text-text">
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
            {t('back')}
          </Link>
        }
        title={t('title')}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={l.status as never} />
            <span className="font-medium text-text">{l.title}</span>
          </span>
        }
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/listings/${l.slug}`}>
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                {t('listing.open')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/account/listings/${l.id}/edit`}>
                <Pencil className="size-4" strokeWidth={2} aria-hidden />
                {t('listing.edit')}
              </Link>
            </Button>
          </>
        }
      />

      <Segmented label={t('period.label')} value={days} onChange={setDays} busy={isValidating} options={PERIODS.map((p) => ({ value: p, label: t(`period.d${p}`) }))} className="mb-5" />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label={t('title')}>
        <Tile icon={Eye} tone="link" label={t('tiles.views')} value={data.totals.views} prev={data.previousTotals.views} />
        <Tile icon={Phone} tone="success" label={t('tiles.reveals')} value={data.totals.reveals} prev={data.previousTotals.reveals} />
        <Tile icon={Heart} tone="danger" label={t('tiles.saves')} value={data.totals.saves} prev={data.previousTotals.saves} />
        <Tile icon={Percent} tone="accent" label={t('tiles.revealRate')} value={data.revealRatePct} suffix="%" />
        <Tile icon={FileSignature} tone="primary" label={t('tiles.offers')} value={data.offers} />
        <Tile icon={CalendarDays} tone="primary" label={t('tiles.viewings')} value={data.viewings} />
      </section>

      <SectionCard title={t('charts.title')} icon={LineChart} tone="link" className="mt-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {(['views', 'reveals', 'saves'] as const).map((k, i) => (
            <div key={k} className={i === 0 ? 'lg:col-span-2' : ''}>
              <BarChart
                label={t(`charts.${k}`)}
                tone={i === 0 ? 'link' : i === 1 ? 'primary' : 'accent'}
                height={i === 0 ? 200 : 190}
                width={i === 0 ? 640 : 400}
                data={data.series.map((p) => ({ day: p.day, value: p[k] }))}
                caption={t('charts.tableCaption', { metric: t(`charts.${k}`) })}
                dayLabel={t('charts.day')}
                valueLabel={t('charts.value')}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DistrictCompare totals={data.totals} avg={data.districtAvg} />
        <PriceCard data={data} />
      </div>

      <SectionCard
        title={t('passport.title')}
        icon={ClipboardList}
        className="mt-6"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href={`/account/listings/${l.id}/edit?step=passport`}>{t('passport.fill')}</Link>
          </Button>
        }
      >
        <div className="flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.passportCompletenessPct} aria-label={t('passport.title')}>
            <div className={cn('h-full rounded-full transition-all duration-500', data.passportCompletenessPct >= 70 ? 'bg-[linear-gradient(90deg,var(--primary),var(--success))]' : 'bg-accent')} style={{ width: `${data.passportCompletenessPct}%` }} />
          </div>
          <span className="text-[15px] font-bold tabular">{t('passport.filled', { pct: data.passportCompletenessPct })}</span>
        </div>
      </SectionCard>

      <Advice listingId={l.id} advice={data.advice} />
    </div>
  );
}

function Tile({ label, value, prev, suffix = '', icon, tone }: { label: string; value: number | null; prev?: number; suffix?: string; icon: typeof Eye; tone: Tone }) {
  const t = useTranslations('stats.tiles');
  const f = useFormat();
  let trend: React.ReactNode = null;
  if (prev !== undefined && value !== null) {
    if (prev === 0) trend = value > 0 ? <Trend pct={null} isNew={t('deltaNew')} /> : null;
    else {
      const pct = Math.round(((value - prev) / prev) * 100);
      const full = t('delta', { sign: pct > 0 ? '+' : pct < 0 ? '−' : '', pct: Math.abs(pct) });
      trend = (
        <span title={full}>
          <Trend pct={pct} label={`${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`} />
          <span className="sr-only">{full}</span>
        </span>
      );
    }
  }
  return <KpiCard icon={icon} tone={tone} label={label} value={value === null ? t('noData') : `${f.number(value)}${suffix}`} trend={trend} />;
}

function DistrictCompare({ totals, avg }: { totals: StatsTotals; avg: ListingStatsDto['districtAvg'] }) {
  const t = useTranslations('stats');
  const rows = (['views', 'reveals', 'saves'] as const).map((k) => ({ k, you: totals[k], avg: avg[k] }));
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <IconTile icon={MapPinned} tone="primary" size="sm" />
        <h2 className="text-[18px] font-bold tracking-tight">{t('district.title')}</h2>
      </div>
      {avg.listings < 2 ? (
        <p className="mt-2 text-small text-muted">{t('district.none')}</p>
      ) : (
        <>
          <p className="mt-1 text-small text-muted">{t('district.subtitle', { district: avg.districtName ?? t('district.unknownDistrict'), count: avg.listings })}</p>
          <dl className="mt-4 flex flex-col gap-4">
            {rows.map((r) => {
              const max = Math.max(1, r.you, r.avg);
              return (
                <div key={r.k}>
                  <dt className="mb-1.5 text-[14px] font-semibold">{t(`charts.${r.k}`)}</dt>
                  <dd className="flex flex-col gap-1">
                    {[
                      { label: t('district.you'), v: r.you, cls: 'bg-[linear-gradient(90deg,var(--primary),var(--primary-500))]' },
                      { label: t('district.avg'), v: r.avg, cls: 'bg-border-strong' },
                    ].map((b) => (
                      <div key={b.label} className="grid grid-cols-[64px_minmax(0,1fr)_48px] items-center gap-2 text-small">
                        <span className="text-muted">{b.label}</span>
                        <span className="h-3 overflow-hidden rounded-full bg-surface-2">
                          <span className={cn('block h-full rounded-full', b.cls)} style={{ width: `${(b.v / max) * 100}%` }} />
                        </span>
                        <span className="text-right font-bold tabular">{b.v}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </section>
  );
}

function PriceCard({ data }: { data: ListingStatsDto }) {
  const t = useTranslations('stats.price');
  const f = useFormat();
  const p = data.price;
  const v = p?.verdict;
  const tone = v === 'above' ? 'danger' : v === 'below' ? 'link' : 'success';
  const Icon = v === 'above' ? TrendingUp : v === 'below' ? TrendingDown : Scale;
  return (
    <section className={cn('card p-5 sm:p-6', v === 'above' && 'ring-1 ring-inset ring-danger/30', v === 'below' && 'ring-1 ring-inset ring-link/30')}>
      <div className="flex items-center gap-3">
        <IconTile icon={p ? Icon : Scale} tone={p ? tone : 'neutral'} size="sm" />
        <h2 className="text-[18px] font-bold tracking-tight">{t('title')}</h2>
      </div>
      {!p ? (
        <p className="mt-3 text-small text-muted">{t('none')}</p>
      ) : (
        <>
          <p className={cn('mt-3 text-[16px] font-semibold', v === 'above' ? 'text-danger' : v === 'below' ? 'text-link' : 'text-success')} role="status">
            {p.messageKa}
          </p>
          <dl className="mt-4 flex flex-col gap-2">
            {[
              { k: t('perM2'), v: p.perM2Minor },
              { k: t('avgM2'), v: p.districtAvgM2Minor },
              { k: t('recommended'), v: p.recommendedMinor },
            ].map((x, i) => (
              <div key={x.k} className={cn('flex items-center justify-between gap-3 rounded-2xl px-4 py-3', i === 2 ? 'bg-primary-soft text-primary-soft-text' : 'bg-surface-2')}>
                <dt className={cn('text-[14px]', i === 2 ? 'font-semibold' : 'text-muted')}>{x.k}</dt>
                <dd className="text-[18px] font-bold tabular">{f.money(x.v)}</dd>
              </div>
            ))}
          </dl>
          {p.verdict !== 'fair' && (
            <Button asChild size="sm" variant="secondary" className="mt-4">
              <Link href={`/account/listings/${data.listing.id}/edit?step=price`}>{t('change')}</Link>
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function Advice({ listingId, advice }: { listingId: string; advice: AdviceItem[] }) {
  const t = useTranslations('stats.advice');
  const [explain, setExplain] = React.useState<{ text: string; source: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sev = {
    high: { box: 'border-danger/25 bg-danger/[0.06]', pill: 'bg-danger/12 text-danger', icon: AlertOctagon, tone: 'danger' as const },
    medium: { box: 'border-accent/40 bg-accent-soft/60', pill: 'bg-accent text-accent-contrast', icon: AlertTriangle, tone: 'accent' as const },
    low: { box: 'border-border bg-surface-2/60', pill: 'bg-surface-3 text-muted', icon: Lightbulb, tone: 'link' as const },
  };
  return (
    <SectionCard
      title={t('title')}
      icon={Sparkles}
      tone="accent"
      className="mt-6"
      action={
        <Button
          size="sm"
          variant="accent"
          loading={loading}
          icon={<Sparkles className="size-4" strokeWidth={2} aria-hidden />}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              setExplain(await apiFetch<{ text: string; source: string }>(`/stats/listings/${listingId}/explain`, { method: 'POST' }));
            } catch (e) {
              setError(e instanceof ClientApiError ? e.message : t('explainError'));
            } finally {
              setLoading(false);
            }
          }}
        >
          {t('explain')}
        </Button>
      }
    >
      <div aria-live="polite">
        {loading && <p className="mb-3 text-small text-muted">{t('explaining')}</p>}
        {error && <p className="mb-3 text-small text-danger">{error}</p>}
        {explain && !loading && (
          <div className="mb-4 rounded-2xl border border-link/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--link)_8%,transparent),transparent)] p-4">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-link/10 px-2.5 py-0.5 text-[12px] font-semibold text-link">
              <Sparkles className="size-3" strokeWidth={2} aria-hidden />
              {explain.source === 'ai' ? t('explainAi') : t('explainRules')}
            </div>
            <p className="whitespace-pre-wrap text-[15px]">{explain.text}</p>
          </div>
        )}
      </div>
      {advice.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-success/[0.07] p-4">
          <IconTile icon={CheckCircle2} tone="success" size="sm" />
          <p className="text-[15px]">{t('empty')}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {advice.map((a) => {
            const x = sev[a.severity];
            return (
              <li key={a.key} className={cn('flex flex-col gap-3 rounded-2xl border p-4', x.box)}>
                <div className="flex items-start gap-3">
                  <IconTile icon={x.icon} tone={x.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className={cn('inline-flex h-6 items-center rounded-full px-2 text-[12px] font-semibold', x.pill)}>{t(a.severity)}</span>
                    <p className="mt-1.5 text-[15px]">{a.messageKa}</p>
                  </div>
                </div>
                {a.action && (
                  <Link href={a.action.href} className="inline-flex items-center gap-1 self-start pl-12 text-small font-semibold text-link hover:underline">
                    {a.action.labelKa}
                    <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
