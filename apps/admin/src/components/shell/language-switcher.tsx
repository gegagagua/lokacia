'use client';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton, Popover } from '@lokacia/ui';

const LOCALES = ['ka', 'en', 'ru'] as const;
/** Language names are always shown in their own language. */
const NATIVE_NAMES: Record<(typeof LOCALES)[number], string> = { ka: 'ქართული', en: 'English', ru: 'Русский' };

/** Internal tool (no SEO): the locale lives in the `lk_locale` cookie; switching reloads the page. */
export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const set = (l: string) => {
    document.cookie = `lk_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <Popover
      align="end"
      className="w-44 p-1"
      trigger={
        <IconButton label={t('language')} size="sm" className="rounded-full">
          <Languages className="size-[18px]" strokeWidth={2} />
        </IconButton>
      }
    >
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} onClick={() => set(l)} aria-current={locale === l ? 'true' : undefined} className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors hover:bg-surface-2 aria-[current=true]:bg-primary-soft aria-[current=true]:text-primary-soft-text">
          {NATIVE_NAMES[l]}
        </button>
      ))}
    </Popover>
  );
}
