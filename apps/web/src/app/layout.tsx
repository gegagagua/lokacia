import Script from 'next/script';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Noto_Sans_Georgian } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { ToastProvider } from '@lokacia/ui';
import { SiteHeader } from '@/components/shell/site-header';
import { SiteFooter } from '@/components/shell/site-footer';
import { FeedbackWidget } from '@/components/v2/feedback-widget';
import { AnalyticsBeacon } from '@/components/v2/analytics-beacon';
import { ImpersonationBanner } from '@/components/v2/impersonation-banner';
import { HTML_LANG } from '@/i18n/locale';
import { getAppLocale, getRequestPathname, localeSeo } from '@/i18n/server';
import { absUrl, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const font = Noto_Sans_Georgian({ subsets: ['georgian', 'latin'], axes: ['wdth'], variable: '--font-georgian', display: 'swap' });
/** Cyrillic glyphs for /ru (Noto Sans Georgian has none); only referenced on Russian pages. */
const cyrillic = Noto_Sans({ subsets: ['cyrillic'], variable: '--font-cyrillic', display: 'swap', preload: false });

/** Defaults for every page; pages override title/description/alternates via `pageMetadata`. hreflang is derived from the request path. */
export async function generateMetadata(): Promise<Metadata> {
  const [locale, path, t] = await Promise.all([getAppLocale(), getRequestPathname(), getTranslations('meta.site')]);
  const seo = localeSeo(path, locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s · ${SITE_NAME}` },
    description: t('description'),
    applicationName: SITE_NAME,
    alternates: seo.alternates,
    openGraph: { type: 'website', siteName: SITE_NAME, locale: seo.ogLocale, alternateLocale: seo.ogAlternateLocales, url: absUrl(seo.alternates.canonical), title: t('ogTitle'), description: t('description') },
    twitter: { card: 'summary_large_image', title: SITE_NAME, description: t('description') },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
    formatDetection: { telephone: false },
    manifest: '/manifest.webmanifest',
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0EB' },
    { media: '(prefers-color-scheme: dark)', color: '#17201D' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/** Applies saved theme before paint (no flash). */
const themeScript = `try{var t=localStorage.getItem('lk-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAppLocale();
  const [messages, t] = await Promise.all([getMessages(), getTranslations('meta.a11y')]);
  const ru = locale === 'ru';
  return (
    <html
      lang={HTML_LANG[locale]}
      className={ru ? `${font.variable} ${cyrillic.variable}` : font.variable}
      style={ru ? ({ '--font-sans': "var(--font-georgian), var(--font-cyrillic), 'Noto Sans Georgian', system-ui, sans-serif" } as React.CSSProperties) : undefined}
      suppressHydrationWarning
    >
      <head>
        <Script id="lk-theme" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body className="flex min-h-dvh flex-col overflow-x-clip bg-bg text-text" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
              {t('skipToContent')}
            </a>
            <ImpersonationBanner />
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <FeedbackWidget />
            <AnalyticsBeacon />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
