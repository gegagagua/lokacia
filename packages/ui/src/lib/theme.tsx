'use client';
import * as React from 'react';

export type ThemeChoice = 'light' | 'dark';

/** Persists the explicit theme choice in localStorage and a cookie (the server renders `data-theme` from the cookie). */
export function persistTheme(next: ThemeChoice) {
  try {
    localStorage.setItem('lk-theme', next);
  } catch {
    /* private mode */
  }
  document.cookie = `lk_theme=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * No inline <script>: the root layout sets `data-theme` from the `lk_theme` cookie. This syncs an older
 * localStorage-only choice (or one set by tests) on first mount.
 */
export function ThemeSync() {
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('lk-theme');
      const el = document.documentElement;
      if ((stored === 'dark' || stored === 'light') && el.dataset.theme !== stored) {
        el.dataset.theme = stored;
        document.cookie = `lk_theme=${stored}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
