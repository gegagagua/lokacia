'use client';
import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { IconButton, persistTheme } from '@lokacia/ui';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
  const t = useTranslations('common.theme');
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const el = document.documentElement;
    setDark(el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  return (
    <IconButton
      label={t('toggle')}
      size="sm"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        persistTheme(next ? 'dark' : 'light');
      }}
    >
      {dark ? <Sun className="size-4" strokeWidth={1.5} /> : <Moon className="size-4" strokeWidth={1.5} />}
    </IconButton>
  );
}
