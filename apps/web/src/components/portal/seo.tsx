import Link from '@/i18n/link';
import type { Metadata } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { absUrl, SITE_NAME } from '@/lib/site';
import { localizePath, toLocale, type Locale } from '@/i18n/locale';
import { getAppLocale, localeSeo } from '@/i18n/server';

/** JSON-LD script tag (schema.org). `<` is escaped so content can never close the script. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export type Crumb = { name: string; href: string };

export function breadcrumbLd(items: Crumb[], locale: Locale = 'ka') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absUrl(localizePath(c.href, locale)) })),
  };
}

/** Visible breadcrumbs + BreadcrumbList JSON-LD. First crumb should be home. Hrefs are unprefixed; the locale prefix is added. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useTranslations('meta.a11y');
  const locale = toLocale(useLocale());
  return (
    <>
      <nav aria-label={t('breadcrumbs')} className={className}>
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
      <JsonLd data={breadcrumbLd(items, locale)} />
    </>
  );
}

/**
 * Standard page metadata: canonical (current language version) + hreflang alternates (ka, en, ru, x-default) + OpenGraph + Twitter.
 * `path` is the unprefixed path (`/search`); the locale prefix is added for en/ru.
 */
export async function pageMetadata(input: { title: string; description: string; path: string; image?: string; noindex?: boolean; type?: 'website' | 'article'; locale?: Locale }): Promise<Metadata> {
  const locale = input.locale ?? (await getAppLocale());
  const seo = localeSeo(input.path, locale);
  const url = absUrl(seo.alternates.canonical);
  const images = [{ url: absUrl(input.image ?? '/opengraph-image'), width: 1200, height: 630, alt: input.title }];
  return {
    title: input.title,
    description: input.description,
    alternates: seo.alternates,
    openGraph: { type: input.type ?? 'website', siteName: SITE_NAME, locale: seo.ogLocale, alternateLocale: seo.ogAlternateLocales, url, title: input.title, description: input.description, images },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description, images: images.map((i) => i.url) },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
