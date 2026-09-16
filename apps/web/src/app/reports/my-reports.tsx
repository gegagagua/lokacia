'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { ReportPurchaseDto } from '@lokacia/contracts';
import { Badge, Button } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

export function MyReports({ compact }: { compact?: boolean }) {
  const t = useTranslations('billing.reports');
  const fmt = useFormat();
  const { data } = useSWR<ReportPurchaseDto[]>('/billing/reports', fetcher);
  if (!data) return null;
  return (
    <section aria-labelledby="my-reports" className={compact ? '' : 'mt-16'}>
      <h2 id="my-reports" className="text-[22px] font-bold leading-tight tracking-tight md:text-[26px]">
        {t('mine')}
      </h2>
      {!data.length ? (
        <p className="mt-3 rounded-card border border-dashed border-border-strong bg-surface px-5 py-6 text-muted">{t('mineEmpty')}</p>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {data.map((r) => (
            <li key={r.id} className="card card-hover flex flex-wrap items-center gap-4 p-4 md:p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger" aria-hidden>
                <FileText className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-[10rem] flex-1">
                <div className="font-semibold">{r.productName}</div>
                <div className="text-small text-muted">
                  {[r.districtName, r.businessType].filter(Boolean).join(' · ')} · {fmt.date(r.createdAt)}
                </div>
              </div>
              {r.status === 'ready' ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={`/api/v1/billing/reports/${r.id}/pdf`}>
                    <Download className="size-4" strokeWidth={2} aria-hidden />
                    {t('download')}
                  </a>
                </Button>
              ) : (
                <Badge tone="outline" icon={r.status === 'paid' ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden /> : undefined}>
                  {r.status === 'paid' ? t('generating') : t('pending')}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
