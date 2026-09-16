'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { formatMoney } from '@lokacia/contracts';
import { Badge, Button, Input, Tabs } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useBusinessTypes } from '@/lib/business-types';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

type DistrictRow = { id: string; city: string; slug: string; nameKa: string; avgPriceM2Minor: number; avgPriceM2OverrideMinor: number | null; activeCount: number; vacancyCount: number };
const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'] as const;

function TypesTable() {
  const t = useTranslations('taxonomy');
  const { data, error, mutate } = useBusinessTypes();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-left text-[14px] tabular">
        <thead>
          <tr className="border-b border-border-strong text-small text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t('name')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('slug')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('utilityCoef')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('fitout')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('filters')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('required')}</th>
          </tr>
        </thead>
        <tbody>
          {[...data]
            .sort((a, b) => a.sort - b.sort)
            .map((b) => (
              <tr key={b.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <Link href={`/taxonomy/${b.id}`} className="font-medium text-link hover:underline">
                    {b.nameKa}
                  </Link>
                  <div className="text-small text-muted">
                    {b.nameEn} · {b.nameRu}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[13px]">{b.slug}</td>
                <td className="px-3 py-2 text-right">{b.utilityCoef}</td>
                <td className="px-3 py-2 text-right">{formatMoney(b.fitoutPerM2Minor)}</td>
                <td className="px-3 py-2 text-right">{b.filterConfig.filters.length}</td>
                <td className="px-3 py-2 text-right">{b.filterConfig.required.length}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function DistrictRowEdit({ d, onSaved }: { d: DistrictRow; onSaved: () => void }) {
  const t = useTranslations('taxonomy');
  const [value, setValue] = React.useState(d.avgPriceM2OverrideMinor === null ? '' : String(d.avgPriceM2OverrideMinor / 100));
  const { run, busy } = useAction();
  const current = d.avgPriceM2OverrideMinor === null ? '' : String(d.avgPriceM2OverrideMinor / 100);
  const save = async (clear?: boolean) => {
    const v = clear ? null : value.trim() === '' ? null : Math.round(Number(value.replace(',', '.')) * 100);
    if (v !== null && !Number.isFinite(v)) return;
    if (await run(() => apiFetch(`/admin/districts/${d.id}`, { method: 'PATCH', body: { avgPriceM2OverrideMinor: v } }), t('districtSaved'))) {
      if (clear) setValue('');
      onSaved();
    }
  };
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2">
        <div className="font-medium">{d.nameKa}</div>
        <div className="font-mono text-[12px] text-muted">{d.slug}</div>
      </td>
      <td className="px-3 py-2 text-right">
        {formatMoney(d.avgPriceM2Minor)}
        {d.avgPriceM2OverrideMinor !== null && (
          <Badge tone="accent" className="ml-2">
            {t('overridden')}
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">{d.activeCount}</td>
      <td className="px-3 py-2 text-right">{d.vacancyCount}</td>
      <td className="px-3 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input aria-label={t('overrideFor', { name: d.nameKa })} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('auto')} suffix="₾" className="w-32 tabular" />
          <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={value === current}>
            {t('save')}
          </Button>
          {d.avgPriceM2OverrideMinor !== null && (
            <Button type="button" size="sm" variant="ghost" onClick={() => save(true)}>
              {t('clear')}
            </Button>
          )}
        </form>
      </td>
    </tr>
  );
}

function DistrictsTable({ city }: { city: string }) {
  const t = useTranslations('taxonomy');
  const { data, error, mutate } = useSWR<DistrictRow[]>(`/admin/districts?city=${city}`, fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-left text-[14px] tabular">
        <thead>
          <tr className="border-b border-border-strong text-small text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t('district')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('avgPrice')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('active')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('vacancy')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('override')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <DistrictRowEdit key={`${d.id}-${d.avgPriceM2OverrideMinor}`} d={d} onSaved={() => mutate()} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaxonomyView() {
  const t = useTranslations('taxonomy');
  const tc = useTranslations('cities');
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild size="sm">
            <Link href="/taxonomy/new">
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('newType')}
            </Link>
          </Button>
        }
      />
      <h2 className="mb-2 text-h3 font-semibold">{t('types')}</h2>
      <TypesTable />
      <h2 className="mb-1 mt-8 text-h3 font-semibold">{t('districts')}</h2>
      <p className="mb-2 text-small text-muted">{t('districtsHint')}</p>
      <Tabs tabs={CITIES.map((c) => ({ value: c, label: tc(c), content: <DistrictsTable city={c} /> }))} />
    </>
  );
}
