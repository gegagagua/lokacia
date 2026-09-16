'use client';
import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton, persistTheme } from '@lokacia/ui';

export function toggleTheme() {
  const el = document.documentElement;
  const dark = el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  el.dataset.theme = next;
  persistTheme(next);
  window.dispatchEvent(new CustomEvent('lk:theme', { detail: next }));
  return next;
}

export function ThemeToggle() {
  const t = useTranslations('shell.user');
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
    read();
    window.addEventListener('lk:theme', read);
    return () => window.removeEventListener('lk:theme', read);
  }, []);
  return (
    <IconButton label={t('theme')} size="sm" className="rounded-full text-muted hover:text-text" onClick={() => setDark(toggleTheme() === 'dark')}>
      {dark ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} />}
    </IconButton>
  );
}
