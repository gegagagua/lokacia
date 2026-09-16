import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FINANCE_KIND_LABELS_KA, type FinanceProductDto, type ListingDetail, type ScanDto, type ScoreResponse, type TrafficResponse } from '@lokacia/contracts';
import { Badge, Card } from '@lokacia/ui';
import { apiOrNull } from '@/lib/api-server';
import { TrafficChart } from './traffic-chart';
import { ScanTour } from './scan-tour';

async function safe<T>(p: Promise<T | null>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
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

  return (
    <section aria-labelledby="v2-analytics" className="mt-10 flex flex-col gap-6">
      <h2 id="v2-analytics" className="text-h2 font-semibold">
        {t('title')}
      </h2>

      {(score || traffic) && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {traffic && (
            <Card className="min-w-0 p-4 md:p-5">
              <h3 className="text-h3 font-semibold">{t('traffic.title')}</h3>
              <p className="mb-3 text-small text-muted">{t('traffic.subtitle')}</p>
              <TrafficChart traffic={traffic} />
            </Card>
          )}
          {score && (
            <Card className="p-4 md:p-5">
              <h3 className="text-h3 font-semibold">{t('score.title')}</h3>
              <div className="mt-3 flex items-end gap-2">
                <span className="compact text-display font-semibold leading-none tabular">{score.score}</span>
                <span className="pb-2 text-muted">/ 100</span>
                <Badge tone={score.score >= 70 ? 'success' : score.score >= 50 ? 'neutral' : 'danger'} className="mb-2 ml-auto">
                  {score.score >= 70 ? t('score.strong') : score.score >= 50 ? t('score.medium') : t('score.weak')}
                </Badge>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {score.components.map((c) => (
                  <li key={c.key}>
                    <div className="flex justify-between gap-2 text-small">
                      <span>{c.label}</span>
                      <span className="tabular text-muted">
                        {c.value} · {t('score.weight', { pct: Math.round(c.weight * 100) })}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.value} aria-label={c.label}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, c.value))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {score.summary && <p className="mt-4 border-t border-border pt-3 text-small">{score.summary}</p>}
            </Card>
          )}
        </div>
      )}

      {readyScans.length > 0 && (
        <Card className="p-4 md:p-5">
          <h3 className="mb-3 text-h3 font-semibold">{t('tour.title')}</h3>
          <ScanTour scans={readyScans} areaM2={listing.areaM2} />
        </Card>
      )}

      {products && products.length > 0 && (
        <div>
          <h3 className="text-h3 font-semibold">{t('finance.title')}</h3>
          <p className="mb-3 text-small text-muted">{t('finance.subtitle')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {products.slice(0, 3).map((p) => (
              <Link key={p.id} href={`/finance?listing=${listing.id}&product=${p.id}`} className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong">
                <div className="text-small text-muted">
                  {FINANCE_KIND_LABELS_KA[p.kind]} · {p.partner}
                </div>
                <div className="mt-1 font-medium">{p.name}</div>
                {p.rateText && <div className="mt-2 text-small tabular">{p.rateText}</div>}
                <div className="mt-3 text-small text-link">{t('finance.apply')} →</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
