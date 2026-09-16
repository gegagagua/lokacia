import { getTranslations } from 'next-intl/server';
import { WifiOff } from 'lucide-react';
import { Logo } from '@lokacia/ui';
import { RetryButton } from './retry-button';

export const dynamic = 'force-static';

export default async function OfflinePage() {
  const t = await getTranslations('shell.offline');
  const nav = await getTranslations('shell.nav');
  return (
    <main className="drawing-grid grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-card border border-border bg-surface p-8 text-center">
        <Logo />
        <WifiOff className="size-8 text-muted" strokeWidth={1.5} aria-hidden />
        <h1 className="text-h3 font-semibold">{t('title')}</h1>
        <p className="text-muted">{t('body')}</p>
        <RetryButton label={t('retry')} />
        <a href="/listings/new" className="text-small text-link underline-offset-4 hover:underline">{nav('addOnSite')}</a>
      </div>
    </main>
  );
}
