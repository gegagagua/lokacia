import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { Plus, Search } from 'lucide-react';
import { DEAL_TYPES } from '@lokacia/contracts';
import { Button, EmptyState, Input, Select } from '@lokacia/ui';
import { getDemandList, getNames } from '@/components/portal/data';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';
import { DemandCard } from '@/components/portal/demand/demand-card';
import { DemandLoadMore } from '@/components/portal/demand/demand-load-more';
import { getFormat } from '@/i18n/server';

type SP = Promise<Record<string, string | string[] | undefined>>;
const KEYS = ['businessType', 'dealType', 'districtId', 'areaMin', 'budgetMax', 'q'] as const;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const t = await getTranslations('demand.board');
  const sp = await searchParams;
  const filtered = KEYS.some((k) => typeof sp[k] === 'string' && sp[k]);
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/demand', noindex: filtered });
}

export default async function DemandBoardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getTranslations('demand');
  const f = await getFormat();
  const qs = new URLSearchParams();
  for (const k of KEYS) {
    const v = sp[k];
    if (typeof v === 'string' && v.trim()) qs.set(k, v.trim());
  }
  qs.set('limit', '18');
  const [{ types, districts }, data] = await Promise.all([getNames(), getDemandList(qs.toString()).catch(() => ({ items: [], total: 0, nextCursor: null }))]);
  const icons = Object.fromEntries(types.map((x) => [x.slug, x.icon]));
  const cities = [...new Set(districts.map((d) => d.city))];
  const val = (k: (typeof KEYS)[number]) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const hasFilters = KEYS.some((k) => val(k));

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'lokacia.ge', href: '/' }, { name: t('board.crumb'), href: '/demand' }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-h2 font-semibold md:text-h1">{t('board.title')}</h1>
          <p className="mt-2 text-muted">{t('board.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/account/demand">{t('board.mine')}</Link>
          </Button>
          <Button asChild>
            <Link href="/demand/new">
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('board.add')}
            </Link>
          </Button>
        </div>
      </div>

      <form method="get" action="/demand" className="mt-6 grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label={t('filters.title')}>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.businessType')}
          <Select name="businessType" defaultValue={val('businessType')} placeholder={t('filters.any')} options={types.map((x) => ({ value: x.slug, label: x.nameKa }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.dealType')}
          <Select name="dealType" defaultValue={val('dealType')} placeholder={t('filters.any')} options={DEAL_TYPES.map((d) => ({ value: d, label: f.dealType(d) }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.district')}
          <select
            name="districtId"
            defaultValue={val('districtId')}
            className="h-10 w-full rounded-button border border-border-strong bg-surface px-3 text-[15px] text-text focus:border-focus focus:outline-none"
          >
            <option value="">{t('filters.any')}</option>
            {cities.map((c) => (
              <optgroup key={c} label={f.city(c)}>
                {districts
                  .filter((d) => d.city === c)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameKa}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.areaMin')}
          <Input name="areaMin" type="number" inputMode="numeric" min={0} defaultValue={val('areaMin')} suffix={f.areaUnit} />
        </label>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.budgetMax')}
          <Input name="budgetMax" type="number" inputMode="numeric" min={0} defaultValue={val('budgetMax')} suffix="₾" />
        </label>
        <label className="flex flex-col gap-1.5 text-small font-medium">
          {t('filters.q')}
          <Input name="q" defaultValue={val('q')} placeholder={t('filters.qPlaceholder')} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" icon={<Search className="size-4" strokeWidth={1.5} aria-hidden />}>
            {t('filters.apply')}
          </Button>
          {hasFilters && (
            <Button asChild variant="ghost">
              <Link href="/demand">{t('board.reset')}</Link>
            </Button>
          )}
          <span className="ml-auto text-small text-muted tabular" aria-live="polite">
            {t('board.found', { count: data.total })}
          </span>
        </div>
      </form>

      {data.items.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={t('board.empty')}
          description={t('board.emptyHint')}
          action={
            <Button asChild>
              <Link href="/demand/new">{t('board.add')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((d) => (
              <li key={d.id}>
                <DemandCard d={d} icon={icons[d.businessType]} />
              </li>
            ))}
          </ul>
          <DemandLoadMore query={qs.toString()} cursor={data.nextCursor} icons={icons} />
        </>
      )}
    </div>
  );
}
