import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ToastProvider, ThemeSync } from '@lokacia/ui';
import './globals.css';

const font = localFont({
  variable: '--font-brand',
  // `optional` avoids a late swap re-triggering LCP on slow networks; fonts are small (≈45 KB) and preloaded.
  display: 'optional',
  src: [
    { path: '../../../../packages/ui/fonts/firago-ka-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../../packages/ui/fonts/firago-ka-600.woff2', weight: '600', style: 'normal' },
    { path: '../../../../packages/ui/fonts/firago-ka-700.woff2', weight: '700', style: 'normal' },
  ],
  fallback: ['Noto Sans Georgian', 'system-ui', 'sans-serif'],
});
/** Cyrillic subset: separate family so ka/en pages never download it. */
const fontCyr = localFont({
  variable: '--font-brand-cyr',
  display: 'swap',
  preload: false,
  src: [
    { path: '../../../../packages/ui/fonts/firago-cyr-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../../packages/ui/fonts/firago-cyr-700.woff2', weight: '700', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: { default: 'lokacia.ge — ადმინ-პანელი', template: '%s · ადმინ-პანელი' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0EB' },
    { media: '(prefers-color-scheme: dark)', color: '#17201D' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeValue = (await cookies()).get('lk_theme')?.value;
  const themeCookie = themeValue === 'dark' || themeValue === 'light' ? themeValue : undefined;
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html data-theme={themeCookie} lang={locale} className={`${font.variable} ${fontCyr.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-text" suppressHydrationWarning>
        <ThemeSync />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
