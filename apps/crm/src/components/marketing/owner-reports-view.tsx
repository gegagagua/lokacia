'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bookmark, Building2, CalendarCheck, CheckCheck, Clock, Eye, FileChartColumn, Phone, Send, type LucideIcon } from 'lucide-react';
import { formatDateKa, formatDateTimeKa, formatNumber, type CrmListingRow, type OwnerReportRow } from '@lokacia/contracts';
import { Button, Drawer, EmptyState, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ChipGroup, IconTile, Pill, StatCard, toneClass, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type MetricKey = 'views' | 'reveals' | 'saves' | 'viewings';
const METRICS: { key: MetricKey; icon: LucideIcon; tone: Tone }[] = [
  { key: 'views', icon: Eye, tone: 2 },
  { key: 'reveals', icon: Phone, tone: 1 },
  { key: 'saves', icon: Bookmark, tone: 5 },
  { key: 'viewings', icon: CalendarCheck, tone: 7 },
];

export function OwnerReportsView() {
  const t = useTranslations('marketing.ownerReports');
  const toast = useToast();
  const { can } = useCrm();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<OwnerReportRow[]>('/crm/owner-reports');
  const { data: listings } = useApi<CrmListingRow[]>('/crm/listings');
  const [week, setWeek] = React.useState('');
  const [open, setOpen] = React.useState<OwnerReportRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const coverById = React.useMemo(() => new Map((listings ?? []).map((l) => [l.id, l.cover])), [listings]);
  const weeks = React.useMemo(() => [...new Set((data ?? []).map((r) => r.weekStart))].sort().reverse(), [data]);
  React.useEffect(() => {
    if (!week && weeks[0]) setWeek(weeks[0]);
  }, [weeks, week]);
  const rows = (data ?? []).filter((r) => !week || r.weekStart === week).sort((a, b) => b.payload.views - a.payload.views);
  const total = rows.reduce((a, r) => ({ views: a.views + r.payload.views, reveals: a.reveals + r.payload.reveals, saves: a.saves + r.payload.saves, viewings: a.viewings + r.payload.viewings }), { views: 0, reveals: 0, saves: 0, viewings: 0 });
  const sent = rows.filter((r) => r.sentAt).length;

  const run = async () => {
    setBusy(true);
    try {
      const r = await mutateApi<{ created: number; sent: number; weekStart: string }>('/crm/owner-reports/run');
      toast({ title: t('ran', r), tone: 'success' });
      await mutate();
      setWeek(r.weekStart);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('settings.manage') && (
            <Button size="sm" onClick={run} loading={busy} icon={<Send className="size-4" strokeWidth={2} aria-hidden />}>
              {t('run')}
            </Button>
          )
        }
      />
      {weeks.length > 0 && <ChipGroup label={t('columns.week')} value={week} onChange={setWeek} options={weeks.slice(0, 12).map((w) => ({ value: w, label: t('week', { date: formatDateKa(w) }) }))} />}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label={t('total')}>
          {METRICS.map((m) => (
            <StatCard key={m.key} label={t(`columns.${m.key}`)} value={formatNumber(total[m.key])} icon={m.icon} tone={m.tone} hint={m.key === 'viewings' ? t('sentOf', { sent, total: rows.length }) : undefined} />
          ))}
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState icon={<FileChartColumn className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t('title')}>
          {rows.map((r) => {
            const cover = coverById.get(r.listingId);
            return (
              <li key={r.id} className="card card-hover relative flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Building2 className="m-3.5 size-5 text-muted" strokeWidth={2} aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setOpen(r)} className="line-clamp-2 text-left text-[14.5px] font-semibold leading-5 after:absolute after:inset-0 after:content-[''] hover:text-primary-soft-text focus-visible:outline-none">
                      {r.listingTitle}
                    </button>
                    <div className="mt-0.5 text-[12.5px] text-muted">{t('week', { date: formatDateKa(r.weekStart) })}</div>
                  </div>
                </div>
                <dl className="grid grid-cols-4 gap-2">
                  {METRICS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.key} className={`rounded-xl bg-tone-faint px-2 py-2 text-center ${toneClass(m.tone)}`}>
                        <dt className="flex justify-center text-tone-ink" title={t(`columns.${m.key}`)}>
                          <Icon className="size-4" strokeWidth={2} aria-hidden />
                          <span className="sr-only">{t(`columns.${m.key}`)}</span>
                        </dt>
                        <dd className="mt-0.5 text-[16px] font-bold tabular">{formatNumber(r.payload[m.key])}</dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  {r.sentAt ? (
                    <Pill tone="success" icon={CheckCheck}>
                      {formatDateTimeKa(r.sentAt)}
                    </Pill>
                  ) : (
                    <Pill tone="neutral" icon={Clock}>
                      {t('notSent')}
                    </Pill>
                  )}
                  <Link href={`/listings/${r.listingId}`} className="relative z-10 text-[13px] font-semibold text-link hover:underline">
                    {t('openListing')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={t('detail')}>
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={FileChartColumn} tone={2} />
              <div className="min-w-0">
                <div className="font-semibold">{open.listingTitle}</div>
                <div className="text-small text-muted">{t('week', { date: formatDateKa(open.weekStart) })}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <StatCard key={m.key} label={t(`columns.${m.key}`)} value={formatNumber(open.payload[m.key])} icon={m.icon} tone={m.tone} className="shadow-none" />
              ))}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3 text-[14px]">
              <span className="text-muted">{t('columns.sent')}</span>
              <span className="font-semibold tabular">{open.sentAt ? formatDateTimeKa(open.sentAt) : t('notSent')}</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
