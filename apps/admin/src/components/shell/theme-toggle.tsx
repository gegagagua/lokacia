'use client';
import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@lokacia/ui';

export function ThemeToggle() {
  const t = useTranslations('common');
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const el = document.documentElement;
    setDark(el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  return (
    <IconButton
      label={t('toggleTheme')}
      size="sm"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        try {
          localStorage.setItem('lk-theme', next ? 'dark' : 'light');
        } catch {
          /* private mode */
        }
      }}
    >
      {dark ? <Sun className="size-4" strokeWidth={1.5} /> : <Moon className="size-4" strokeWidth={1.5} />}
    </IconButton>
  );
}
