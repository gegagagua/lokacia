'use client';
import { useLocale, useTranslations } from 'next-intl';
import { LocaleMenu, type MenuLocale } from '@lokacia/ui';

/** Internal tool (no SEO): the locale lives in the `lk_locale` cookie; switching reloads the page. */
export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale() as MenuLocale;
  return (
    <LocaleMenu
      locale={locale}
      label={t('language')}
      onSelect={(l) => {
        document.cookie = `lk_locale=${l}; path=/; max-age=31536000; samesite=lax`;
        window.location.reload();
      }}
    />
  );
}
