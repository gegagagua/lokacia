import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Markdown from 'react-markdown';
import gfm from 'remark-gfm';
import { getCmsPage } from '@/components/portal/data';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';
import { getFormat } from '@/i18n/server';
import { HeroGlow } from '@/components/portal/page-hero';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

function excerpt(md: string) {
  return md
    .replace(/^#.*$/gm, '')
    .replace(/[*_>#`[\]()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) return { title: (await getTranslations('meta.titles'))('notFound'), robots: { index: false } };
  return pageMetadata({ title: page.title, description: excerpt(page.bodyMd), path: `/pages/${slug}`, type: 'article' });
}

/** Static CMS pages managed in admin (about, terms, privacy…). */
export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();
  const t = await getTranslations('seo');
  const fmt = await getFormat();
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80">
        <HeroGlow variant="page" />
      </div>
      <div className="container-page py-8 md:py-12">
        <Breadcrumbs items={[{ name: t('home'), href: '/' }, { name: page.title, href: `/pages/${slug}` }]} className="mx-auto mb-6 max-w-3xl" />
        <article className="prose-ka card mx-auto max-w-3xl p-6 shadow-md md:p-12">
          <Markdown remarkPlugins={[gfm]}>{page.bodyMd.startsWith('# ') ? page.bodyMd : `# ${page.title}\n\n${page.bodyMd}`}</Markdown>
          <p className="mt-10 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-small text-muted">{t('page.updated', { date: fmt.date(page.updatedAt) })}</p>
        </article>
      </div>
    </div>
  );
}
