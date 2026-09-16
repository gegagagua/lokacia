import { getTranslations } from 'next-intl/server';
import { Camera, WifiOff } from 'lucide-react';
import { Logo } from '@lokacia/ui';
import { RetryButton } from './retry-button';

export const dynamic = 'force-static';

export default async function OfflinePage() {
  const t = await getTranslations('shell.offline');
  const nav = await getTranslations('shell.nav');
  return (
    <main id="main" className="crm-wash grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Logo />
        <div className="card flex w-full flex-col items-center gap-4 p-8 text-center shadow-md">
          <span className="relative grid size-16 place-items-center rounded-3xl bg-accent-soft text-text" aria-hidden>
            <WifiOff className="size-7" strokeWidth={2} />
            <span className="absolute -right-1 -top-1 size-4 rounded-full bg-accent ring-4 ring-surface" />
          </span>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{t('title')}</h1>
          <p className="text-muted">{t('body')}</p>
          <div className="mt-2 flex w-full flex-col gap-2">
            <RetryButton label={t('retry')} />
            <a href="/listings/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-border bg-surface px-5 text-[15px] font-semibold shadow-xs transition-all hover:border-border-strong hover:bg-surface-2">
              <Camera className="size-4" strokeWidth={2} aria-hidden />
              {nav('addOnSite')}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
