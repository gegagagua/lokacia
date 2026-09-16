import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Megaphone, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { DEAL_TYPES } from '@lokacia/contracts';
import { Button, EmptyState, Input, Select } from '@lokacia/ui';
import { getDemandList, getNames } from '@/components/portal/data';
import { pageMetadata } from '@/components/portal/seo';
import { PageHero } from '@/components/portal/page-hero';
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
    <>
      <PageHero
        crumbs={[{ name: 'lokacia.ge', href: '/' }, { name: t('board.crumb'), href: '/demand' }]}
        eyebrow={t('board.eyebrow')}
        eyebrowIcon={<Megaphone className="size-3.5" strokeWidth={2} aria-hidden />}
        title={t('board.title')}
        lead={t('board.subtitle')}
        actions={
          <>
            <Button asChild variant="secondary" size="lg">
              <Link href="/account/demand">{t('board.mine')}</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/demand/new">
                <Plus className="size-4" strokeWidth={2.25} aria-hidden />
                {t('board.add')}
              </Link>
            </Button>
          </>
        }
      >
        <form method="get" action="/demand" className="card grid grid-cols-2 gap-3 p-4 md:gap-4 md:p-5 lg:grid-cols-6" aria-label={t('filters.title')}>
          <p className="col-span-2 flex items-center gap-2 text-[15px] font-semibold lg:col-span-6">
            <SlidersHorizontal className="size-4 text-primary-500" strokeWidth={2} aria-hidden />
            {t('filters.title')}
          </p>
          <label className="flex flex-col gap-1.5 text-small font-medium">
            {t('filters.businessType')}
            <Select name="businessType" defaultValue={val('businessType')} placeholder={t('filters.any')} options={types.map((x) => ({ value: x.slug, label: x.nameKa }))} />
          </label>
          <label className="flex flex-col gap-1.5 text-small font-medium">
            {t('filters.dealType')}
            <Select name="dealType" defaultValue={val('dealType')} placeholder={t('filters.any')} options={DEAL_TYPES.map((d) => ({ value: d, label: f.dealType(d) }))} />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 text-small font-medium lg:col-span-1">
            {t('filters.district')}
            <select
              name="districtId"
              defaultValue={val('districtId')}
              className="h-12 w-full rounded-button border border-border bg-surface px-3.5 text-[15px] text-text shadow-xs transition-shadow hover:border-border-strong focus:border-focus focus:shadow-ring focus:outline-none"
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
          <label className="col-span-2 flex flex-col gap-1.5 text-small font-medium lg:col-span-1">
            {t('filters.q')}
            <Input name="q" defaultValue={val('q')} placeholder={t('filters.qPlaceholder')} />
          </label>
          <div className="flex flex-wrap items-center gap-2 col-span-2 border-t border-border pt-4 lg:col-span-6">
            <Button type="submit" icon={<Search className="size-4" strokeWidth={2} aria-hidden />}>
              {t('filters.apply')}
            </Button>
            {hasFilters && (
              <Button asChild variant="ghost">
                <Link href="/demand">{t('board.reset')}</Link>
              </Button>
            )}
            <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-small font-semibold text-primary-soft-text tabular" aria-live="polite">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              {t('board.found', { count: data.total })}
            </span>
          </div>
        </form>
      </PageHero>

      <div className="container-page py-10 md:py-14">
        {data.items.length === 0 ? (
          <EmptyState
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
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((d) => (
                <li key={d.id}>
                  <DemandCard d={d} icon={icons[d.businessType]} />
                </li>
              ))}
            </ul>
            <DemandLoadMore query={qs.toString()} cursor={data.nextCursor} icons={icons} />
          </>
        )}

        <section className="hero-gradient relative mt-14 overflow-hidden rounded-modal p-6 shadow-lg md:mt-20 md:p-10" aria-labelledby="demand-cta">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <h2 id="demand-cta" className="text-[26px] font-bold leading-tight tracking-tight md:text-h2">
                {t('board.ctaTitle')}
              </h2>
              <p className="mt-2 text-[17px] text-white/80">{t('board.ctaLead')}</p>
            </div>
            <Button asChild variant="accent" size="lg" className="self-start md:self-center">
              <Link href="/demand/new">
                {t('board.add')}
                <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
