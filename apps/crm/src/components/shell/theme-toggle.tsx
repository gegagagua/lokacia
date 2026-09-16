'use client';
import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@lokacia/ui';

export function toggleTheme() {
  const el = document.documentElement;
  const dark = el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  el.dataset.theme = next;
  try {
    localStorage.setItem('lk-theme', next);
  } catch {
    /* private mode */
  }
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
    <IconButton label={t('theme')} size="sm" onClick={() => setDark(toggleTheme() === 'dark')}>
      {dark ? <Sun className="size-4" strokeWidth={1.5} /> : <Moon className="size-4" strokeWidth={1.5} />}
    </IconButton>
  );
}
