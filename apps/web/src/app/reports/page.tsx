import type { Metadata } from 'next';
import { pageMetadata } from '@/components/portal/seo';
import { getTranslations } from 'next-intl/server';
import { FileBarChart2, FileText, MapPin, Users } from 'lucide-react';
import type { PlansResponse } from '@lokacia/contracts';
import { apiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { getFormat } from '@/i18n/server';
import { getBusinessTypes, getDistricts } from '@/lib/taxonomy';
import { PageHero } from '@/components/billing/page-parts';
import { ReportBuilder } from './report-builder';
import { MyReports } from './my-reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing.reports');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/reports' });
}

export default async function ReportsPage() {
  const t = await getTranslations('billing.reports');
  const fmt = await getFormat();
  const [districts, types, plans, session] = await Promise.all([
    getDistricts().catch(() => []),
    getBusinessTypes().catch(() => []),
    apiOrNull<PlansResponse>('/v1/billing/plans', { auth: false, revalidate: 60 }).catch(() => null),
    getSession(),
  ]);
  const cities = [...new Set(districts.map((d) => d.city))].sort((a, b) => (a === 'tbilisi' ? -1 : b === 'tbilisi' ? 1 : a.localeCompare(b)));
  const products = (plans?.plans ?? []).filter((p) => p.audience === 'report' && p.active);
  const highlights = [
    { icon: MapPin, label: t('hlDistricts'), value: fmt.number(districts.length) },
    { icon: Users, label: t('hlTypes'), value: fmt.number(types.length) },
    { icon: FileText, label: t('hlFormat'), value: 'PDF' },
  ];
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="drawing-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="container-page relative py-12 md:py-16">
          <PageHero
            eyebrow={t('eyebrow')}
            eyebrowIcon={<FileBarChart2 className="size-3.5" strokeWidth={2} aria-hidden />}
            title={t('title')}
            lead={t('subtitle')}
            aside={
              <div className="grid grid-cols-3 gap-3">
                {highlights.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="card p-4 md:p-5">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <dl className="mt-3 flex flex-col-reverse">
                      <dt className="mt-1.5 text-small text-muted">{label}</dt>
                      <dd className="text-[26px] font-bold leading-none tracking-tight tabular md:text-[32px]">{value}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </section>
      <div className="container-page">
        <ReportBuilder
          loggedIn={!!session}
          cities={cities.map((c) => ({ value: c, label: fmt.city(c) }))}
          districts={districts.map((d) => ({ id: d.id, city: d.city, name: d.nameKa }))}
          types={types.map((b) => ({ value: b.slug, label: b.nameKa }))}
          products={products}
          promoActive={!!plans?.promoActive}
        />
        {session && <MyReports />}
      </div>
    </div>
  );
}
