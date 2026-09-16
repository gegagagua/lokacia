import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Georgian } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ToastProvider } from '@lokacia/ui';
import { SiteHeader } from '@/components/shell/site-header';
import { SiteFooter } from '@/components/shell/site-footer';
import { FeedbackWidget } from '@/components/v2/feedback-widget';
import { AnalyticsBeacon } from '@/components/v2/analytics-beacon';
import { ImpersonationBanner } from '@/components/v2/impersonation-banner';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const font = Noto_Sans_Georgian({ subsets: ['georgian', 'latin'], axes: ['wdth'], variable: '--font-georgian', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — კომერციული ფართები საქართველოში`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/', languages: { ka: '/', 'x-default': '/' } },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'ka_GE', url: SITE_URL, title: `${SITE_NAME} — კომერციული ფართები`, description: SITE_DESCRIPTION },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  formatDetection: { telephone: false },
  manifest: '/manifest.webmanifest',
};

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
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col overflow-x-clip bg-bg text-text" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
              მთავარ შინაარსზე გადასვლა
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
