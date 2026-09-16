import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api-server';
import { getBusinessTypes, getDistrictStats, getNames } from '@/components/portal/data';
import { MapExplorer, type DistrictStat, type MapState } from '@/components/portal/map/map-explorer';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';

export const revalidate = 600;

const CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi'];

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const t = await getTranslations('map');
  const filtered = Object.keys(sp).length > 0;
  return { ...(await pageMetadata({ title: t('title'), description: t('metaDescription'), path: '/map' })), ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}

export default async function MapPage({ searchParams }: Props) {
  const sp = await searchParams;
  const t = await getTranslations('map');
  const ts = await getTranslations('seo');
  const types = await getBusinessTypes().catch(() => []);
  const state: MapState = {
    metric: sp.metric === 'vacancy' ? 'vacancy' : sp.metric === 'traffic' ? 'traffic' : 'price',
    businessType: sp.businessType && types.some((b) => b.slug === sp.businessType) ? sp.businessType : '',
    dealType: sp.dealType === 'sale' ? 'sale' : 'rent',
    city: CITIES.includes(sp.city ?? '') ? sp.city! : 'tbilisi',
  };
  const qs = new URLSearchParams({ city: state.city, dealType: state.dealType });
  if (state.businessType) qs.set('businessType', state.businessType);
  const [stats, geojson, names] = await Promise.all([
    getDistrictStats(qs.toString()).catch(() => [] as DistrictStat[]),
    api<{ type: 'FeatureCollection'; features: [] }>(`/v1/taxonomy/districts.geojson?city=${state.city}`, { auth: false, revalidate: 600 }).catch(() => ({ type: 'FeatureCollection' as const, features: [] })),
    getNames(),
  ]);
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: ts('home'), href: '/' }, { name: t('title'), href: '/map' }]} className="mb-4" />
      <header className="mb-6 max-w-2xl">
        <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </header>
      <MapExplorer initial={state} initialStats={stats} initialGeojson={geojson} businessTypes={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa }))} districtNames={names.districtNames} />
    </div>
  );
}
