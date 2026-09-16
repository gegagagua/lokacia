import Script from 'next/script';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ToastProvider } from '@lokacia/ui';
import { SwRegister } from '@/components/shell/sw-register';
import './globals.css';

const font = localFont({
  variable: '--font-brand',
  display: 'swap',
  src: [
    { path: '../../node_modules/@fontsource/firago/files/firago-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@fontsource/firago/files/firago-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@fontsource/firago/files/firago-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@fontsource/firago/files/firago-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  fallback: ['Noto Sans Georgian', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'lokacia CRM', template: '%s · lokacia CRM' },
  description: 'ბროკერის სამუშაო სივრცე: კლიენტები, გარიგებები, ჩვენებები, ფართები.',
  applicationName: 'lokacia CRM',
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: 'lokacia CRM', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0EB' },
    { media: '(prefers-color-scheme: dark)', color: '#17201D' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Applies saved theme before paint (no flash). Shared key with the portal. */
const themeScript = `try{var t=localStorage.getItem('lk-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={font.variable} suppressHydrationWarning>
      <head>
        <Script id="lk-theme" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body className="min-h-dvh bg-bg text-text" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            {children}
            <SwRegister />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
