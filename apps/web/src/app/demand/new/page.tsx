import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { Breadcrumbs } from '@/components/portal/seo';
import { DemandForm } from '@/components/portal/demand/demand-form';
import { CITY_NAMES_KA } from '@/lib/site';

export const metadata: Metadata = { title: 'მოთხოვნის დამატება', robots: { index: false, follow: true }, alternates: { canonical: '/demand/new' } };

export default async function NewDemandPage() {
  const user = await getSession();
  if (!user) redirect('/login?next=/demand/new');
  const t = await getTranslations('demand');
  const { types, districts } = await getNames();
  const groups = [...new Set(districts.map((d) => d.city))].map((city) => ({
    city,
    name: CITY_NAMES_KA[city] ?? city,
    districts: districts.filter((d) => d.city === city).map((d) => ({ id: d.id, name: d.nameKa })),
  }));
  return (
    <div className="container-page max-w-3xl py-8">
      <Breadcrumbs
        items={[
          { name: 'lokacia.ge', href: '/' },
          { name: t('board.crumb'), href: '/demand' },
          { name: t('form.title'), href: '/demand/new' },
        ]}
      />
      <h1 className="mt-4 text-h2 font-semibold md:text-h1">{t('form.title')}</h1>
      <p className="mt-2 text-muted">{t('form.subtitle')}</p>
      <DemandForm types={types.map((x) => ({ value: x.slug, label: x.nameKa }))} groups={groups} defaultPhone={user.phone ?? ''} />
    </div>
  );
}
