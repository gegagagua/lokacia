import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { absUrl, SITE_NAME } from '@/lib/site';

/** JSON-LD script tag (schema.org). `<` is escaped so content can never close the script. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export type Crumb = { name: string; href: string };

export function breadcrumbLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absUrl(c.href) })),
  };
}

/** Visible breadcrumbs + BreadcrumbList JSON-LD. First crumb should be home. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <>
      <nav aria-label="ნავიგაციის ჯაჭვი" className={className}>
        <ol className="flex flex-wrap items-center gap-1 text-small text-muted">
          {items.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5" strokeWidth={1.5} aria-hidden />}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-text">
                  {c.name}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-link hover:underline">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(items)} />
    </>
  );
}

/** Standard page metadata: canonical + OpenGraph + Twitter. */
export function pageMetadata(input: { title: string; description: string; path: string; image?: string; noindex?: boolean; type?: 'website' | 'article' }): Metadata {
  const url = absUrl(input.path);
  const images = input.image ? [{ url: absUrl(input.image), width: 1200, height: 630, alt: input.title }] : undefined;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: { type: input.type ?? 'website', siteName: SITE_NAME, locale: 'ka_GE', url, title: input.title, description: input.description, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description, ...(images ? { images: images.map((i) => i.url) } : {}) },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
