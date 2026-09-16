import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { EmptyState } from '@lokacia/ui';
import { getProjects } from '@/components/portal/data';
import { ProjectCard } from '@/components/portal/projects/project-card';
import { Breadcrumbs, JsonLd, pageMetadata } from '@/components/portal/seo';
import { CITY_NAMES_KA, absUrl } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('projects');
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: '/projects' });
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const t = await getTranslations('projects');
  const all = await getProjects().catch(() => []);
  const cities = [...new Set(all.map((p) => p.city).filter((c): c is string => !!c))];
  const items = city ? all.filter((p) => p.city === city) : all;
  const chip = (active: boolean) =>
    `inline-flex h-9 items-center rounded-button border px-3 text-[15px] transition-colors duration-150 ${active ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:bg-surface-2'}`;
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('breadcrumbHome'), href: '/' }, { name: t('title'), href: '/projects' }]} className="mb-4" />
      <header className="mb-6 max-w-2xl">
        <h1 className="text-h2 font-semibold md:text-h1">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </header>
      {cities.length > 1 && (
        <nav aria-label={t('cityFilter')} className="mb-6 flex flex-wrap gap-2">
          <Link href="/projects" className={chip(!city)} aria-current={!city ? 'page' : undefined}>
            {t('allCities')}
          </Link>
          {cities.map((c) => (
            <Link key={c} href={`/projects?city=${c}`} className={chip(city === c)} aria-current={city === c ? 'page' : undefined}>
              {CITY_NAMES_KA[c] ?? c}
            </Link>
          ))}
        </nav>
      )}
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
