'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { formatMoney, type SourceRoi } from '@lokacia/contracts';
import { Button, Card, Field, IconButton, Input, Select, Skeleton, Table, useToast } from '@lokacia/ui';
import { HBarChart } from '@/components/analytics/charts';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Source = { id: string; key: string; name: string; monthlyCostMinor: number | null };
const pct = (n: number | null) => (n == null ? '—' : `${String(n).replace('.', ',')}%`);

export default function SourcesPage() {
  return (
    <RequirePerm perm="finance.view">
      <Sources />
    </RequirePerm>
  );
}

function Sources() {
  const t = useTranslations('analytics.sources');
  const common = useTranslations('shell.common');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { can } = useCrm();
  const editable = can('sources.manage');
  const [months, setMonths] = React.useState('6');
  const { data: sources, mutate } = useApi<Source[]>('/crm/sources');
  const { data: roi, mutate: mutateRoi } = useApi<{ items: SourceRoi[] }>(`/crm/sources/roi?months=${months}`);
  const [draft, setDraft] = React.useState({ key: '', name: '', cost: '' });

  const save = async (s: Source, patch: Partial<{ name: string; monthlyCostMinor: number }>) => {
    try {
      await mutateApi(`/crm/sources/${s.id}`, { method: 'PATCH', body: patch });
      toast({ title: t('saved'), tone: 'success' });
      await Promise.all([mutate(), mutateRoi()]);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('roiTitle')}</h2>
            <p className="text-small text-muted">{t('roiHint')}</p>
          </div>
          <Field label={t('months')}>
            <Select value={months} onChange={(e) => setMonths(e.target.value)} options={['1', '3', '6', '12'].map((m) => ({ value: m, label: t('monthsValue', { n: m }) }))} className="w-32" />
          </Field>
        </div>
        {!roi ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="flex flex-col gap-4">
            <HBarChart caption={t('wonCommission')} valueHeader={t('wonCommission')} data={roi.items.map((r) => ({ key: r.key, label: r.name, value: r.wonCommissionMinor ?? 0, display: `${formatMoney(r.wonCommissionMinor ?? 0)} · ROI ${pct(r.roiPct)}`, tone: r.roiPct != null && r.roiPct < 0 ? 'danger' : 'primary' }))} />
            <Table
              rows={roi.items}
              rowKey={(r) => r.key}
              initialSort={{ key: 'commission', dir: 'desc' }}
              columns={[
                { key: 'name', header: t('name'), cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
                { key: 'leads', header: t('leads'), align: 'right', cell: (r) => r.leads, sortValue: (r) => r.leads },
                { key: 'deals', header: t('deals'), align: 'right', cell: (r) => r.deals, sortValue: (r) => r.deals },
                { key: 'won', header: t('won'), align: 'right', cell: (r) => r.won, sortValue: (r) => r.won },
                { key: 'conversion', header: t('conversion'), align: 'right', cell: (r) => pct(r.conversionPct), sortValue: (r) => r.conversionPct },
                { key: 'commission', header: t('wonCommission'), align: 'right', cell: (r) => formatMoney(r.wonCommissionMinor ?? 0), sortValue: (r) => r.wonCommissionMinor ?? 0 },
                { key: 'cost', header: t('cost'), align: 'right', cell: (r) => (r.costMinor == null ? '—' : formatMoney(r.costMinor)), sortValue: (r) => r.costMinor ?? -1 },
                { key: 'cpl', header: t('costPerLead'), align: 'right', cell: (r) => (r.costPerLeadMinor == null ? '—' : formatMoney(r.costPerLeadMinor)), sortValue: (r) => r.costPerLeadMinor ?? -1 },
                { key: 'roi', header: t('roi'), align: 'right', cell: (r) => <span className={r.roiPct != null && r.roiPct < 0 ? 'text-danger' : r.roiPct != null ? 'text-success' : ''}>{pct(r.roiPct)}</span>, sortValue: (r) => r.roiPct ?? -Infinity },
              ]}
            />
          </div>
        )}
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{t('listTitle')}</h2>
        {!sources ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="flex flex-col">
            {sources.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_140px_auto] items-center gap-2 border-b border-border py-2 last:border-b-0 sm:grid-cols-[120px_1fr_160px_auto]">
                <code className="hidden text-small text-muted sm:block">{s.key}</code>
                <Input aria-label={t('name')} defaultValue={s.name} disabled={!editable} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && save(s, { name: e.target.value.trim() })} />
                <Input aria-label={t('monthlyCost')} inputMode="decimal" defaultValue={s.monthlyCostMinor == null ? '' : String(s.monthlyCostMinor / 100)} disabled={!editable} suffix="₾" className="tabular" onBlur={(e) => { const v = Math.round(Number(e.target.value.replace(',', '.') || 0) * 100); if (v !== s.monthlyCostMinor) void save(s, { monthlyCostMinor: v }); }} />
                {editable ? (
                  <IconButton
                    label={common('delete')}
                    size="sm"
                    onClick={async () => {
                      try {
                        await mutateApi(`/crm/sources/${s.id}`, { method: 'DELETE' });
                        toast({ title: t('deleted'), tone: 'success' });
                        await Promise.all([mutate(), mutateRoi()]);
                      } catch (e) {
                        toast({ title: errorMessage(e), tone: 'danger' });
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                  </IconButton>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form
            className="mt-4 grid gap-2 sm:grid-cols-[120px_1fr_160px_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await mutateApi('/crm/sources', { body: { key: draft.key.trim(), name: draft.name.trim(), monthlyCostMinor: Math.round(Number(draft.cost.replace(',', '.') || 0) * 100) } });
                setDraft({ key: '', name: '', cost: '' });
                toast({ title: t('added'), tone: 'success' });
                await Promise.all([mutate(), mutateRoi()]);
              } catch (err) {
                toast({ title: errorMessage(err), tone: 'danger' });
              }
            }}
          >
            <Field label={t('key')}>
              <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} required placeholder="tiktok" />
            </Field>
            <Field label={t('name')}>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </Field>
            <Field label={t('monthlyCost')}>
              <Input inputMode="decimal" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} className="tabular" />
            </Field>
            <Button type="submit">{t('add')}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
