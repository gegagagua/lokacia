'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import type { ReportPurchaseDto } from '@lokacia/contracts';
import { Badge, Button, Card } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

export function MyReports({ compact }: { compact?: boolean }) {
  const t = useTranslations('billing.reports');
  const fmt = useFormat();
  const { data } = useSWR<ReportPurchaseDto[]>('/billing/reports', fetcher);
  if (!data) return null;
  return (
    <section aria-labelledby="my-reports" className={compact ? '' : 'mt-12'}>
      <h2 id="my-reports" className="text-h3 font-semibold md:text-h2">
        {t('mine')}
      </h2>
      {!data.length ? (
        <p className="mt-2 text-muted">{t('mineEmpty')}</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {data.map((r) => (
            <Card as="li" key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium">{r.productName}</div>
                <div className="text-small text-muted">
                  {[r.districtName, r.businessType].filter(Boolean).join(' · ')} · {fmt.date(r.createdAt)}
                </div>
              </div>
              {r.status === 'ready' ? (
                <Button asChild size="sm" variant="secondary" icon={<Download className="size-4" strokeWidth={1.5} aria-hidden />}>
                  <a href={`/api/v1/billing/reports/${r.id}/pdf`}>{t('download')}</a>
                </Button>
              ) : (
                <Badge tone="outline">{r.status === 'paid' ? t('generating') : t('pending')}</Badge>
              )}
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}
