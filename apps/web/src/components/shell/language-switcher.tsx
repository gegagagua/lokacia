'use client';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton, Popover } from '@lokacia/ui';

/** ka is active; en/ru are visible placeholders for v2 (PRODUCT.md V8). */
export function LanguageSwitcher() {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const set = (l: string) => {
    document.cookie = `lk_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <Popover
      align="end"
      className="w-48 p-1"
      trigger={
        <IconButton label={t('label')} size="sm">
          <Languages className="size-4" strokeWidth={1.5} />
        </IconButton>
      }
    >
      {(['ka', 'en', 'ru'] as const).map((l) => (
        <button key={l} type="button" onClick={() => set(l)} aria-current={locale === l} className="flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-left text-[15px] hover:bg-surface-2 aria-[current=true]:font-semibold">
          {t(l)}
          {l !== 'ka' && <span className="text-[11px] text-muted">{t('soon')}</span>}
        </button>
      ))}
    </Popover>
  );
}
