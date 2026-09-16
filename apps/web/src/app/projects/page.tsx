import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { EmptyState } from '@lokacia/ui';
import { getProjects } from '@/components/portal/data';
import { ProjectCard } from '@/components/portal/projects/project-card';
import { JsonLd, pageMetadata } from '@/components/portal/seo';
import { PageHero } from '@/components/portal/page-hero';
import { absUrl } from '@/lib/site';
import { getFormat } from '@/i18n/server';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/projects' });
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const t = await getTranslations('projects');
  const f = await getFormat();
  const all = await getProjects().catch(() => []);
  const cities = [...new Set(all.map((p) => p.city).filter((c): c is string => !!c))];
  const items = city ? all.filter((p) => p.city === city) : all;
  const chip = (active: boolean) =>
    `inline-flex h-10 items-center rounded-full border px-4 text-[15px] font-medium shadow-xs transition-all duration-200 ${active ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm'}`;
  return (
    <>
      <PageHero
        crumbs={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('title'), href: '/projects' }]}
        eyebrow={t('eyebrow')}
        eyebrowIcon={<Building2 className="size-3.5" strokeWidth={2} aria-hidden />}
        title={t('title')}
        lead={t('subtitle')}
      >
        {cities.length > 1 && (
          <nav aria-label={t('cityFilter')} className="flex flex-wrap gap-2">
            <Link href="/projects" className={chip(!city)} aria-current={!city ? 'page' : undefined}>
              {t('allCities')}
            </Link>
            {cities.map((c) => (
              <Link key={c} href={`/projects?city=${c}`} className={chip(city === c)} aria-current={city === c ? 'page' : undefined}>
                {f.city(c)}
              </Link>
            ))}
          </nav>
        )}
      </PageHero>
      <div className="container-page py-10 md:py-14">
      {items.length ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0">
          {items.map((p, i) => (
            <li key={p.id}>
              <ProjectCard project={p} priority={i < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Building2 className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Link href="/projects" className="text-link hover:underline">{t('allCities')}</Link>} />
      )}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/projects/${p.slug}`), name: p.name })),
        }}
      />
      </div>
    </>
  );
}
