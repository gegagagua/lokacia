'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';

export function useOnline() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const t = useTranslations('shell.offline');
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-accent bg-accent/15 px-4 py-2 text-small">
      <WifiOff className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      {t('banner')}
    </div>
  );
}
