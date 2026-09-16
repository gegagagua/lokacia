'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Coins, Megaphone, Percent, Plus, Radio, Trash2, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatMoney, type SourceRoi } from '@lokacia/contracts';
import { Button, Field, IconButton, Input, Skeleton, Table, useToast } from '@lokacia/ui';
import { HBarChart } from '@/components/analytics/charts';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
import { EmptyHint, IconTile, Pill, Progress, SectionCard, Segmented, StatCard, toneFor } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Source = { id: string; key: string; name: string; monthlyCostMinor: number | null };
const pct = (n: number | null) => (n == null ? '—' : `${String(Math.round(n * 10) / 10).replace('.', ',')}%`);

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
  const [months, setMonths] = React.useState<'1' | '3' | '6' | '12'>('6');
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

  const items = roi?.items ?? [];
  const totals = items.reduce((a, r) => ({ leads: a.leads + r.leads, won: a.won + r.won, commission: a.commission + (r.wonCommissionMinor ?? 0), cost: a.cost + (r.costMinor ?? 0) }), { leads: 0, won: 0, commission: 0, cost: 0 });
  const totalRoi = totals.cost > 0 ? ((totals.commission - totals.cost) / totals.cost) * 100 : null;
  const sorted = items.slice().sort((a, b) => (b.wonCommissionMinor ?? 0) - (a.wonCommissionMinor ?? 0) || b.leads - a.leads);
  const maxLeads = Math.max(1, ...items.map((r) => r.leads));

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className="mb-1"
        actions={<Segmented label={t('months')} value={months} onChange={setMonths} options={(['1', '3', '6', '12'] as const).map((m) => ({ value: m, label: t('monthsValue', { n: m }) }))} />}
      />

      {!roi ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <StatCard label={t('leads')} value={totals.leads} icon={Users} tone={2} hint={t('wonOf', { won: totals.won })} />
          <StatCard label={t('wonCommission')} value={<span className="whitespace-nowrap text-[22px] sm:text-[28px]">{formatMoney(totals.commission)}</span>} icon={Coins} tone={3} />
          <StatCard label={t('cost')} value={<span className="whitespace-nowrap text-[22px] sm:text-[28px]">{formatMoney(totals.cost)}</span>} icon={Wallet} tone={7} hint={totals.leads ? t('perLead', { value: formatMoney(Math.round(totals.cost / totals.leads)) }) : undefined} />
          <StatCard label={t('roi')} value={pct(totalRoi)} icon={totalRoi != null && totalRoi < 0 ? TrendingDown : TrendingUp} tone={totalRoi != null && totalRoi < 0 ? 'danger' : 'success'} hint={t('roiHint')} />
        </div>
      )}

      <SectionCard icon={Megaphone} tone={5} title={t('roiTitle')} description={t('roiCardsHint')}>
        {!roi ? (
          <Skeleton className="h-48" />
        ) : items.length === 0 ? (
          <EmptyHint icon={Radio} title={t('empty')} />
        ) : (
          <div className="flex flex-col gap-6">
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((r) => {
                const negative = r.roiPct != null && r.roiPct < 0;
                return (
                  <li key={r.key} className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Radio} tone={toneFor(r.key)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{r.name}</div>
                        <div className="text-[12.5px] text-muted tabular">{r.costMinor == null ? t('noCost') : t('costValue', { value: formatMoney(r.costMinor) })}</div>
                      </div>
                      <Pill tone={r.roiPct == null ? 'neutral' : negative ? 'danger' : 'success'} icon={r.roiPct == null ? undefined : negative ? TrendingDown : TrendingUp}>
                        ROI {pct(r.roiPct)}
                      </Pill>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-2.5 text-center">
                      <div>
                        <dt className="text-[12px] text-muted">{t('leads')}</dt>
                        <dd className="text-[17px] font-bold tabular">{r.leads}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted">{t('deals')}</dt>
                        <dd className="text-[17px] font-bold tabular">{r.deals}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted">{t('won')}</dt>
                        <dd className="text-[17px] font-bold text-success tabular">{r.won}</dd>
                      </div>
                    </dl>
                    <div>
                      <div className="mb-1 flex justify-between text-[12.5px] text-muted">
                        <span>{t('leads')}</span>
                        <span className="tabular">{t('conversionValue', { value: pct(r.conversionPct) })}</span>
                      </div>
                      <Progress value={(r.leads / maxLeads) * 100} tone={toneFor(r.key)} label={`${r.name}: ${t('leads')}`} />
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border pt-3">
                      <span className="text-[13px] text-muted">{t('wonCommission')}</span>
                      <span className="font-bold tabular">{formatMoney(r.wonCommissionMinor ?? 0)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="mb-3 text-[14.5px] font-semibold">{t('commissionBySource')}</h3>
                <div className="max-w-3xl">
                <HBarChart
                  caption={t('wonCommission')}
                  valueHeader={t('wonCommission')}
                  data={sorted.map((r) => ({ key: r.key, label: r.name, value: r.wonCommissionMinor ?? 0, display: formatMoney(r.wonCommissionMinor ?? 0), tone: r.roiPct != null && r.roiPct < 0 ? 'danger' : toneFor(r.key) }))}
                />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="mb-3 text-[14.5px] font-semibold">{t('table')}</h3>
                <Table
                  rows={items}
                  rowKey={(r) => r.key}
                  initialSort={{ key: 'commission', dir: 'desc' }}
                  columns={[
                    { key: 'name', header: t('name'), cell: (r) => <span className="whitespace-nowrap font-medium">{r.name}</span>, sortValue: (r) => r.name },
                    { key: 'leads', header: t('leads'), align: 'right', cell: (r) => r.leads, sortValue: (r) => r.leads },
                    { key: 'deals', header: t('deals'), align: 'right', cell: (r) => r.deals, sortValue: (r) => r.deals },
                    { key: 'won', header: t('won'), align: 'right', cell: (r) => r.won, sortValue: (r) => r.won },
                    { key: 'conversion', header: t('conversion'), align: 'right', cell: (r) => pct(r.conversionPct), sortValue: (r) => r.conversionPct },
                    { key: 'commission', header: t('wonCommission'), align: 'right', cell: (r) => <span className="whitespace-nowrap">{formatMoney(r.wonCommissionMinor ?? 0)}</span>, sortValue: (r) => r.wonCommissionMinor ?? 0 },
                    { key: 'cost', header: t('cost'), align: 'right', cell: (r) => <span className="whitespace-nowrap">{r.costMinor == null ? '—' : formatMoney(r.costMinor)}</span>, sortValue: (r) => r.costMinor ?? -1 },
                    { key: 'cpl', header: t('costPerLead'), align: 'right', cell: (r) => <span className="whitespace-nowrap">{r.costPerLeadMinor == null ? '—' : formatMoney(r.costPerLeadMinor)}</span>, sortValue: (r) => r.costPerLeadMinor ?? -1 },
                    { key: 'roi', header: t('roi'), align: 'right', cell: (r) => <span className={r.roiPct != null && r.roiPct < 0 ? 'font-semibold text-danger' : r.roiPct != null ? 'font-semibold text-success' : ''}>{pct(r.roiPct)}</span>, sortValue: (r) => r.roiPct ?? -Infinity },
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Percent} tone={1} title={t('listTitle')} description={t('listHint')}>
        {!sources ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded-2xl border border-border bg-surface-2/50 p-2 sm:grid-cols-[auto_1fr_180px_auto] sm:gap-3">
                <span className="hidden items-center gap-2 sm:flex">
                  <span aria-hidden className={`size-2.5 rounded-full bg-tone tone-${toneFor(s.key)}`} />
                  <code className="w-24 truncate rounded-md bg-surface px-1.5 py-0.5 text-[12px] text-muted ring-1 ring-border">{s.key}</code>
                </span>
                <Input aria-label={t('name')} defaultValue={s.name} disabled={!editable} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && save(s, { name: e.target.value.trim() })} />
                <Input aria-label={t('monthlyCost')} inputMode="decimal" defaultValue={s.monthlyCostMinor == null ? '' : String(s.monthlyCostMinor / 100)} disabled={!editable} suffix="₾" className="tabular" onBlur={(e) => { const v = Math.round(Number(e.target.value.replace(',', '.') || 0) * 100); if (v !== s.monthlyCostMinor) void save(s, { monthlyCostMinor: v }); }} />
                {editable ? (
                  <IconButton
                    label={common('delete')}
                    size="sm"
                    className="text-danger hover:bg-danger/10"
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
                    <Trash2 className="size-4" strokeWidth={2} />
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
            className="mt-4 grid gap-3 rounded-2xl border border-dashed border-border-strong p-3 sm:grid-cols-[140px_1fr_180px_auto] sm:items-end"
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
            <Button type="submit" icon={<Plus className="size-4" strokeWidth={2.4} />}>
              {t('add')}
            </Button>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
