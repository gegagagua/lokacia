'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ChevronRight, MapPin, Plus, Store, Tags } from 'lucide-react';
import { formatMoney } from '@lokacia/contracts';
import { Button, Input } from '@lokacia/ui';
import { PillFilter, StatusPill, TableCard, THead, td, th, tr } from '@/components/kit';
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {[...data]
        .sort((a, b) => a.sort - b.sort)
        .map((b) => (
          <Link key={b.id} href={`/taxonomy/${b.id}`} className="card card-hover group flex min-w-0 flex-col p-5 focus-visible:shadow-ring focus-visible:outline-none">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">
                <Store className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold">{b.nameKa}</div>
                <div className="truncate text-[13px] text-muted">
                  {b.nameEn} · {b.nameRu}
                </div>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
            </div>
            <span className="mt-3 w-fit rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] text-muted">{b.slug}</span>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: t('utilityCoef'), value: b.utilityCoef },
                { label: t('fitout'), value: formatMoney(b.fitoutPerM2Minor) },
                { label: t('filters'), value: b.filterConfig.filters.length },
                { label: t('required'), value: b.filterConfig.required.length },
              ].map((x) => (
                <div key={x.label} className="min-w-0 rounded-xl bg-surface-2/70 px-3 py-2">
                  <dt className="text-[12px] leading-tight text-muted">{x.label}</dt>
                  <dd className="font-bold tabular">{x.value}</dd>
                </div>
              ))}
            </dl>
          </Link>
        ))}
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
    <tr className={tr}>
      <td className={td}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-link/10 text-link">
            <MapPin className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="font-semibold">{d.nameKa}</div>
            <div className="font-mono text-[12px] text-muted">{d.slug}</div>
          </div>
        </div>
      </td>
      <td className={`${td} text-right`}>
        <div className="flex items-center justify-end gap-2">
          {d.avgPriceM2OverrideMinor !== null && <StatusPill tone="accent" dot={false}>{t('overridden')}</StatusPill>}
          <span className="font-bold">{formatMoney(d.avgPriceM2Minor)}</span>
        </div>
      </td>
      <td className={`${td} text-right font-semibold`}>{d.activeCount}</td>
      <td className={`${td} text-right`}>
        <StatusPill tone={d.vacancyCount > 0 ? 'info' : 'neutral'} dot={false}>
          {d.vacancyCount}
        </StatusPill>
      </td>
      <td className={td}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input aria-label={t('overrideFor', { name: d.nameKa })} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('auto')} suffix="₾" className="w-36 tabular [&_input]:h-10" />
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
    <TableCard minWidth={860} label={t('districts')}>
      <THead>
        <th scope="col" className={th}>{t('district')}</th>
        <th scope="col" className={`${th} text-right`}>{t('avgPrice')}</th>
        <th scope="col" className={`${th} text-right`}>{t('active')}</th>
        <th scope="col" className={`${th} text-right`}>{t('vacancy')}</th>
        <th scope="col" className={th}>{t('override')}</th>
      </THead>
      <tbody>
        {data.map((d) => (
          <DistrictRowEdit key={`${d.id}-${d.avgPriceM2OverrideMinor}`} d={d} onSaved={() => mutate()} />
        ))}
      </tbody>
    </TableCard>
  );
}

export function TaxonomyView() {
  const t = useTranslations('taxonomy');
  const tc = useTranslations('cities');
  const [city, setCity] = React.useState<(typeof CITIES)[number]>('tbilisi');
  return (
    <>
      <PageHeader
        icon={Tags}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild>
            <Link href="/taxonomy/new">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t('newType')}
            </Link>
          </Button>
        }
      />
      <h2 className="mb-4 flex items-center gap-2 text-[22px] font-bold tracking-tight">
        <Store className="size-5 text-muted" strokeWidth={2} aria-hidden />
        {t('types')}
      </h2>
      <TypesTable />
      <div className="mb-4 mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
            <MapPin className="size-5 text-muted" strokeWidth={2} aria-hidden />
            {t('districts')}
          </h2>
          <p className="mt-1 max-w-3xl text-small text-muted">{t('districtsHint')}</p>
        </div>
        <PillFilter label={t('city')} value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: tc(c) }))} />
      </div>
      <DistrictsTable city={city} />
    </>
  );
}
