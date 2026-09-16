'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { formatMoney, type AdviceItem, type ListingStatsDto, type StatsTotals } from '@lokacia/contracts';
import { Badge, Button, cn } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { AccountPageHeader } from '../page-header';
import { ListingStatusBadge } from '../status-badges';
import { BarChart } from './bar-chart';

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
          <Link href="/account/listings" className="inline-flex items-center gap-1 text-link hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('back')}
          </Link>
        }
        title={t('title')}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={l.status as never} />
            <span className="text-text">{l.title}</span>
          </span>
        }
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/listings/${l.slug}`}>{t('listing.open')}</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/account/listings/${l.id}/edit`}>{t('listing.edit')}</Link>
            </Button>
          </>
        }
      />

      <div role="radiogroup" aria-label={t('period.label')} className="mb-5 inline-flex rounded-button border border-border bg-surface p-0.5" aria-busy={isValidating}>
        {PERIODS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={days === p} onClick={() => setDays(p)} className={cn('h-8 rounded-[5px] px-3 text-small', days === p ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text')}>
            {t(`period.d${p}`)}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-label={t('title')}>
        <Tile label={t('tiles.views')} value={data.totals.views} prev={data.previousTotals.views} />
        <Tile label={t('tiles.reveals')} value={data.totals.reveals} prev={data.previousTotals.reveals} />
        <Tile label={t('tiles.saves')} value={data.totals.saves} prev={data.previousTotals.saves} />
        <Tile label={t('tiles.revealRate')} value={data.revealRatePct} suffix="%" />
        <Tile label={t('tiles.offers')} value={data.offers} />
        <Tile label={t('tiles.viewings')} value={data.viewings} />
      </section>

      <section className="mt-6 rounded-card border border-border bg-surface p-4">
        <h2 className="mb-3 text-h3 font-semibold">{t('charts.title')}</h2>
        <div className="grid gap-6">
          {(['views', 'reveals', 'saves'] as const).map((k, i) => (
            <BarChart
              key={k}
              label={t(`charts.${k}`)}
              tone={i === 0 ? 'primary' : i === 1 ? 'link' : 'primary'}
              data={data.series.map((p) => ({ day: p.day, value: p[k] }))}
              caption={t('charts.tableCaption', { metric: t(`charts.${k}`) })}
              dayLabel={t('charts.day')}
              valueLabel={t('charts.value')}
            />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DistrictCompare totals={data.totals} avg={data.districtAvg} />
        <PriceCard data={data} />
      </div>

      <section className="mt-6 rounded-card border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h3 font-semibold">{t('passport.title')}</h2>
          <Link href={`/account/listings/${l.id}/edit?step=passport`} className="text-small text-link hover:underline">
            {t('passport.fill')}
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.passportCompletenessPct} aria-label={t('passport.title')}>
            <div className={cn('h-full rounded-full', data.passportCompletenessPct >= 70 ? 'bg-primary' : 'bg-accent')} style={{ width: `${data.passportCompletenessPct}%` }} />
          </div>
          <span className="text-small tabular">{t('passport.filled', { pct: data.passportCompletenessPct })}</span>
        </div>
      </section>

      <Advice listingId={l.id} advice={data.advice} />
    </div>
  );
}

function Tile({ label, value, prev, suffix = '' }: { label: string; value: number | null; prev?: number; suffix?: string }) {
  const t = useTranslations('stats.tiles');
  let delta: React.ReactNode = null;
  if (prev !== undefined && value !== null) {
    if (prev === 0) delta = value > 0 ? <span className="text-muted">{t('deltaNew')}</span> : null;
    else {
      const pct = Math.round(((value - prev) / prev) * 100);
      delta = <span className={pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-muted'}>{t('delta', { sign: pct > 0 ? '+' : pct < 0 ? '−' : '', pct: Math.abs(pct) })}</span>;
    }
  }
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="text-small text-muted">{label}</div>
      <div className="compact mt-1 text-h2 font-semibold tabular">{value === null ? t('noData') : `${value}${suffix}`}</div>
      {delta && <div className="mt-1 text-[12px] tabular">{delta}</div>}
    </div>
  );
}

function DistrictCompare({ totals, avg }: { totals: StatsTotals; avg: ListingStatsDto['districtAvg'] }) {
  const t = useTranslations('stats');
  const rows = (['views', 'reveals', 'saves'] as const).map((k) => ({ k, you: totals[k], avg: avg[k] }));
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-h3 font-semibold">{t('district.title')}</h2>
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
                  <dt className="mb-1 text-small font-medium">{t(`charts.${r.k}`)}</dt>
                  <dd className="flex flex-col gap-1">
                    {[
                      { label: t('district.you'), v: r.you, cls: 'bg-primary' },
                      { label: t('district.avg'), v: r.avg, cls: 'bg-border-strong' },
                    ].map((b) => (
                      <div key={b.label} className="grid grid-cols-[64px_minmax(0,1fr)_48px] items-center gap-2 text-small">
                        <span className="text-muted">{b.label}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                          <span className={cn('block h-full rounded-full', b.cls)} style={{ width: `${(b.v / max) * 100}%` }} />
                        </span>
                        <span className="text-right tabular">{b.v}</span>
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
  const p = data.price;
  return (
    <section className={cn('rounded-card border bg-surface p-4', p?.verdict === 'above' ? 'border-accent' : 'border-border')}>
      <h2 className="text-h3 font-semibold">{t('title')}</h2>
      {!p ? (
        <p className="mt-2 text-small text-muted">{t('none')}</p>
      ) : (
        <>
          <p className={cn('mt-2 font-medium', p.verdict === 'above' ? 'text-danger' : p.verdict === 'below' ? 'text-link' : 'text-success')} role="status">
            {p.messageKa}
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-small sm:grid-cols-3">
            <div className="rounded-button bg-surface-2 p-2">
              <dt className="text-muted">{t('perM2')}</dt>
              <dd className="font-medium tabular">{formatMoney(p.perM2Minor)}</dd>
            </div>
            <div className="rounded-button bg-surface-2 p-2">
              <dt className="text-muted">{t('avgM2')}</dt>
              <dd className="font-medium tabular">{formatMoney(p.districtAvgM2Minor)}</dd>
            </div>
            <div className="rounded-button bg-surface-2 p-2">
              <dt className="text-muted">{t('recommended')}</dt>
              <dd className="font-medium tabular">{formatMoney(p.recommendedMinor)}</dd>
            </div>
          </dl>
          {p.verdict !== 'fair' && (
            <Button asChild size="sm" variant="secondary" className="mt-3">
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
  const tone = { high: 'danger', medium: 'accent', low: 'outline' } as const;
  return (
    <section className="mt-6 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3 font-semibold">{t('title')}</h2>
        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          icon={<Sparkles className="size-4" strokeWidth={1.5} aria-hidden />}
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
      </div>
      <div aria-live="polite">
        {loading && <p className="mt-3 text-small text-muted">{t('explaining')}</p>}
        {error && <p className="mt-3 text-small text-danger">{error}</p>}
        {explain && !loading && (
          <div className="mt-3 rounded-button border border-link/30 bg-link/5 p-3">
            <div className="mb-1 text-[12px] text-muted">{explain.source === 'ai' ? t('explainAi') : t('explainRules')}</div>
            <p className="whitespace-pre-wrap text-[15px]">{explain.text}</p>
          </div>
        )}
      </div>
      {advice.length === 0 ? (
        <p className="mt-3 text-small text-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {advice.map((a) => (
            <li key={a.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3">
              <Badge tone={tone[a.severity]} className="self-start">
                {t(a.severity)}
              </Badge>
              <p className="flex-1 text-[15px]">{a.messageKa}</p>
              {a.action && (
                <Link href={a.action.href} className="shrink-0 text-small text-link hover:underline">
                  {a.action.labelKa}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
