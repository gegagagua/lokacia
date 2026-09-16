import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Markdown from 'react-markdown';
import gfm from 'remark-gfm';
import { getCmsPage } from '@/components/portal/data';
import { Breadcrumbs, pageMetadata } from '@/components/portal/seo';
import { getFormat } from '@/i18n/server';

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
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ name: t('home'), href: '/' }, { name: page.title, href: `/pages/${slug}` }]} className="mb-6" />
      <article className="prose-ka mx-auto max-w-3xl rounded-card border border-border bg-surface p-6 md:p-10">
        <Markdown remarkPlugins={[gfm]}>{page.bodyMd.startsWith('# ') ? page.bodyMd : `# ${page.title}\n\n${page.bodyMd}`}</Markdown>
        <p className="mt-8 text-small text-muted">{t('page.updated', { date: fmt.date(page.updatedAt) })}</p>
      </article>
    </div>
  );
}
