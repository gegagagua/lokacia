'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileChartColumn, Send } from 'lucide-react';
import { formatDateKa, formatDateTimeKa, formatNumber, type OwnerReportRow } from '@lokacia/contracts';
import { Badge, Button, Drawer, EmptyState, Skeleton, SpecRow, Table, useToast, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

export function OwnerReportsView() {
  const t = useTranslations('marketing.ownerReports');
  const toast = useToast();
  const { can } = useCrm();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<OwnerReportRow[]>('/crm/owner-reports');
  const [week, setWeek] = React.useState('');
  const [open, setOpen] = React.useState<OwnerReportRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const weeks = React.useMemo(() => [...new Set((data ?? []).map((r) => r.weekStart))].sort().reverse(), [data]);
  React.useEffect(() => {
    if (!week && weeks[0]) setWeek(weeks[0]);
  }, [weeks, week]);
  const rows = (data ?? []).filter((r) => !week || r.weekStart === week);
  const total = rows.reduce((a, r) => ({ views: a.views + r.payload.views, reveals: a.reveals + r.payload.reveals, viewings: a.viewings + r.payload.viewings }), { views: 0, reveals: 0, viewings: 0 });

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

  const columns: Column<OwnerReportRow>[] = [
    {
      key: 'listing',
      header: t('columns.listing'),
      sortValue: (r) => r.listingTitle,
      cell: (r) => (
        <Link href={`/listings/${r.listingId}`} onClick={(e) => e.stopPropagation()} className="line-clamp-1 min-w-[200px] font-medium hover:underline">
          {r.listingTitle}
        </Link>
      ),
    },
    { key: 'views', header: t('columns.views'), align: 'right', sortValue: (r) => r.payload.views, cell: (r) => formatNumber(r.payload.views) },
    { key: 'reveals', header: t('columns.reveals'), align: 'right', sortValue: (r) => r.payload.reveals, cell: (r) => formatNumber(r.payload.reveals) },
    { key: 'saves', header: t('columns.saves'), align: 'right', sortValue: (r) => r.payload.saves, cell: (r) => formatNumber(r.payload.saves) },
    { key: 'viewings', header: t('columns.viewings'), align: 'right', sortValue: (r) => r.payload.viewings, cell: (r) => formatNumber(r.payload.viewings) },
    { key: 'sent', header: t('columns.sent'), sortValue: (r) => r.sentAt, cell: (r) => (r.sentAt ? <span className="whitespace-nowrap text-small text-muted">{formatDateTimeKa(r.sentAt)}</span> : <Badge tone="outline">{t('notSent')}</Badge>) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('settings.manage') && (
            <Button size="sm" onClick={run} loading={busy} icon={<Send className="size-3.5" strokeWidth={1.5} aria-hidden />}>
              {t('run')}
            </Button>
          )
        }
      />
      {weeks.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('columns.week')}>
          {weeks.slice(0, 12).map((w) => (
            <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)} className={`h-8 rounded-button border px-3 text-small tabular ${week === w ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:bg-surface-2'}`}>
              {t('week', { date: formatDateKa(w) })}
            </button>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <p className="text-small text-muted tabular">
          {t('total')}: {formatNumber(total.views)} · {formatNumber(total.reveals)} · {formatNumber(total.viewings)}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !rows.length ? (
        <EmptyState icon={<FileChartColumn className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={setOpen} initialSort={{ key: 'views', dir: 'desc' }} />
      )}
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={t('detail')}>
        {open && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-semibold">{open.listingTitle}</div>
              <div className="text-small text-muted">{t('week', { date: formatDateKa(open.weekStart) })}</div>
            </div>
            <div>
              <SpecRow label={t('columns.views')} value={formatNumber(open.payload.views)} />
              <SpecRow label={t('columns.reveals')} value={formatNumber(open.payload.reveals)} />
              <SpecRow label={t('columns.saves')} value={formatNumber(open.payload.saves)} />
              <SpecRow label={t('columns.viewings')} value={formatNumber(open.payload.viewings)} />
              <SpecRow label={t('columns.sent')} value={open.sentAt ? formatDateTimeKa(open.sentAt) : t('notSent')} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
