import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BarChart3, Box, Footprints, Gauge, Landmark } from 'lucide-react';
import type { FinanceProductDto, ListingDetail, ScanDto, ScoreResponse, TrafficResponse } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { PartnerLogo } from '@/components/billing/partner-logo';
import { TrafficChart } from './traffic-chart';
import { ScanTour } from './scan-tour';

async function safe<T>(p: Promise<T | null>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function CardHead({ icon: Icon, title, subtitle, tone = 'primary', aside }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; subtitle?: string; tone?: 'primary' | 'link' | 'accent'; aside?: React.ReactNode }) {
  const tones = { primary: 'bg-primary-soft text-primary-soft-text', link: 'bg-link/10 text-link', accent: 'bg-accent-soft text-[#7a5200] dark:text-accent' };
  return (
    <div className="flex items-start gap-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[19px] font-bold leading-tight tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-small text-muted">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Radial gauge 0–100 with a gradient arc (server-rendered SVG). */
function ScoreGauge({ score, label, tone }: { score: number; label: string; tone: 'success' | 'accent' | 'danger' }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const arc = 0.75; // 270° gauge
  const value = Math.max(0, Math.min(100, score)) / 100;
  const colors = { success: ['var(--primary-500)', 'var(--success)'], accent: ['var(--accent)', 'var(--primary-500)'], danger: ['var(--danger)', 'var(--accent)'] }[tone];
  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 128 128" className="size-full -rotate-[225deg]" aria-hidden>
        <defs>
          <linearGradient id="lk-score-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${C * arc} ${C}`} />
        <circle cx="64" cy="64" r={R} fill="none" stroke="url(#lk-score-arc)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${Math.max(0.01, C * arc * value)} ${C}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[46px] font-bold leading-none tracking-tight tabular">{score}</span>
        <span className="mt-1 text-small text-muted">/ 100</span>
      </div>
      <span className={cn('absolute bottom-1 left-1/2 inline-flex h-7 -translate-x-1/2 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold', tone === 'success' ? 'bg-success/12 text-success' : tone === 'accent' ? 'bg-accent-soft text-[#6b4700] dark:text-accent' : 'bg-danger/10 text-danger')}>{label}</span>
    </div>
  );
}

/**
 * Slot rendered at the end of the public listing page. Owned by the v2 work stream
 * (foot traffic chart, location score breakdown, 3D tour viewer, finance offers).
 */
export async function ListingV2Section({ listing }: { listing: ListingDetail }) {
  const t = await getTranslations('v2');
  const bt = listing.businessTypes[0];
  const opts = { auth: false, revalidate: 300 } as const;
  const [traffic, score, scans, products] = await Promise.all([
    safe(apiOrNull<TrafficResponse>(`/v1/v2/listings/${listing.id}/traffic`, opts)),
    safe(apiOrNull<ScoreResponse>(`/v1/v2/listings/${listing.id}/score${bt ? `?businessType=${encodeURIComponent(bt)}` : ''}`, opts)),
    safe(apiOrNull<ScanDto[]>(`/v1/v2/listings/${listing.id}/scans`, opts)),
    safe(apiOrNull<FinanceProductDto[]>('/v1/finance/products', opts)),
  ]);
  const readyScans = (scans ?? []).filter((s) => s.status === 'ready');
  if (!traffic && !score && !readyScans.length && !products?.length) return null;
  const scoreTone = score ? (score.score >= 70 ? 'success' : score.score >= 50 ? 'accent' : 'danger') : 'accent';

  return (
    <section aria-labelledby="v2-analytics" className="mt-12 flex flex-col gap-6">
      <div>
        <span className="eyebrow">
          <BarChart3 className="size-3.5" strokeWidth={2} aria-hidden />
          {t('eyebrow')}
        </span>
        <h2 id="v2-analytics" className="mt-3 text-[26px] font-bold leading-tight tracking-tight md:text-h2">
          {t('title')}
        </h2>
        <p className="mt-1.5 max-w-2xl text-muted">{t('lead')}</p>
      </div>

      {traffic && (
        <div className="card min-w-0 p-5 md:p-6">
          <CardHead icon={Footprints} title={t('traffic.title')} subtitle={t('traffic.subtitle')} />
          <div className="mt-5">
            <TrafficChart traffic={traffic} />
          </div>
        </div>
      )}

      {score && (
        <div className="card min-w-0 p-5 md:p-6">
          <CardHead icon={Gauge} tone="accent" title={t('score.title')} />
          <div className="mt-5 grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-2/70 p-5">
              <ScoreGauge score={score.score} tone={scoreTone} label={score.score >= 70 ? t('score.strong') : score.score >= 50 ? t('score.medium') : t('score.weak')} />
              {score.summary && <p className="text-center text-[15px]">{score.summary}</p>}
            </div>
            <div className="min-w-0">
              <h4 className="text-small font-semibold text-muted">{t('score.components')}</h4>
              <ul className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
                {score.components.map((c) => {
                  const v = Math.max(0, Math.min(100, c.value));
                  return (
                    <li key={c.key} className="min-w-0">
                      <div className="flex items-end justify-between gap-3">
                        <span className="min-w-0 text-[15px] font-medium leading-snug">{c.label}</span>
                        <span className="shrink-0 text-[22px] font-bold leading-none tracking-tight tabular">{c.value}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.value} aria-label={c.label}>
                        <div className={cn('h-full rounded-full bg-gradient-to-r', v >= 70 ? 'from-primary-500 to-success' : v >= 50 ? 'from-accent to-primary-500' : 'from-danger to-accent')} style={{ width: `${Math.max(3, v)}%` }} />
                      </div>
                      <div className="mt-1 text-small text-muted tabular">{t('score.weight', { pct: Math.round(c.weight * 100) })}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {readyScans.length > 0 && (
        <div className="card overflow-hidden p-5 md:p-6">
          <CardHead icon={Box} tone="link" title={t('tour.title')} subtitle={t('tour.hint')} />
          <div className="mt-5">
            <ScanTour scans={readyScans} areaM2={listing.areaM2} />
          </div>
        </div>
      )}

      {products && products.length > 0 && (
        <div className="relative overflow-hidden rounded-card border border-border bg-surface p-5 shadow-sm md:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_70%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <CardHead icon={Landmark} tone="accent" title={t('finance.title')} subtitle={t('finance.subtitle')} />
            <Link href={`/finance?listing=${listing.id}`} className="inline-flex items-center gap-1.5 text-small font-semibold text-link hover:underline">
              {t('finance.all')}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <div className="relative mt-5 grid gap-4 md:grid-cols-3">
            {products.slice(0, 3).map((p) => (
              <Link key={p.id} href={`/finance?listing=${listing.id}&product=${p.id}`} className="group flex flex-col rounded-2xl border border-border bg-surface p-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-md focus-visible:shadow-ring focus-visible:outline-none">
                <div className="flex items-center gap-3">
                  <PartnerLogo name={p.partner} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-small font-semibold">{p.partner}</div>
                    <div className="truncate text-small text-muted">{t(`finance.kinds.${p.kind}`)}</div>
                  </div>
                </div>
                <div className="mt-3 flex-1 font-semibold leading-snug">{p.name}</div>
                {p.rateText && <div className="mt-2 inline-flex w-fit rounded-full bg-primary-soft px-2.5 py-0.5 text-small font-semibold text-primary-soft-text tabular">{p.rateText}</div>}
                <div className="mt-4 inline-flex items-center gap-1.5 text-small font-semibold text-link">
                  {t('finance.apply')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
