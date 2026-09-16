import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { getNames } from '@/components/portal/data';
import { CheckCircle2, Lightbulb, Megaphone } from 'lucide-react';
import { PageHero } from '@/components/portal/page-hero';
import { DemandForm } from '@/components/portal/demand/demand-form';
import { getAppLocale, getFormat } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('demandNew'), robots: { index: false, follow: true }, alternates: { canonical: '/demand/new' } };
}

export default async function NewDemandPage() {
  const user = await getSession();
  if (!user) redirect(localizePath('/login?next=/demand/new', await getAppLocale()));
  const t = await getTranslations('demand');
  const f = await getFormat();
  const { types, districts } = await getNames();
  const groups = [...new Set(districts.map((d) => d.city))].map((city) => ({
    city,
    name: f.city(city),
    districts: districts.filter((d) => d.city === city).map((d) => ({ id: d.id, name: d.nameKa })),
  }));
  return (
    <>
      <PageHero
        size="sm"
        crumbs={[
          { name: 'lokacia.ge', href: '/' },
          { name: t('board.crumb'), href: '/demand' },
          { name: t('form.title'), href: '/demand/new' },
        ]}
        eyebrow={t('form.eyebrow')}
        eyebrowIcon={<Megaphone className="size-3.5" strokeWidth={2} aria-hidden />}
        title={t('form.title')}
        lead={t('form.subtitle')}
      />
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DemandForm types={types.map((x) => ({ value: x.slug, label: x.nameKa }))} groups={groups} defaultPhone={user.phone ?? ''} />
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-text">
                <Lightbulb className="size-4" strokeWidth={2} aria-hidden />
              </span>
              {t('form.tipsTitle')}
            </p>
            <ul className="mt-4 flex flex-col gap-3 text-[15px]">
              {(['tip1', 'tip2', 'tip3'] as const).map((k) => (
                <li key={k} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
                  <span className="text-muted">{t(`form.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
