import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { PlansResponse } from '@lokacia/contracts';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { absUrl, CITY_NAMES_KA, SITE_NAME } from '@/lib/site';
import { getBusinessTypes, getDistricts } from '@/lib/taxonomy';
import { ReportBuilder } from './report-builder';
import { MyReports } from './my-reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing.reports');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/reports' },
    openGraph: { title: `${t('metaTitle')} · ${SITE_NAME}`, description: t('metaDescription'), url: absUrl('/reports'), type: 'website' },
    twitter: { card: 'summary', title: t('metaTitle'), description: t('metaDescription') },
  };
}

export default async function ReportsPage() {
  const t = await getTranslations('billing.reports');
  const [districts, types, plans, session] = await Promise.all([
    getDistricts().catch(() => []),
    getBusinessTypes().catch(() => []),
    apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null),
    getSession(),
  ]);
  const cities = [...new Set(districts.map((d) => d.city))].sort((a, b) => (a === 'tbilisi' ? -1 : b === 'tbilisi' ? 1 : a.localeCompare(b)));
  const products = (plans?.plans ?? []).filter((p) => p.audience === 'report' && p.active);
  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="text-h1 font-semibold">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </header>
      <ReportBuilder
        loggedIn={!!session}
        cities={cities.map((c) => ({ value: c, label: CITY_NAMES_KA[c] ?? c }))}
        districts={districts.map((d) => ({ id: d.id, city: d.city, name: d.nameKa }))}
        types={types.map((b) => ({ value: b.slug, label: b.nameKa }))}
        products={products}
        promoActive={!!plans?.promoActive}
      />
      {session && <MyReports />}
    </div>
  );
}
