'use client';
import * as React from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn, IconButton, Popover } from '@lokacia/ui';
import { LOCALE_COOKIE, LOCALES, switchLocaleHref, toLocale, type Locale } from '@/i18n/locale';

/** Language names are always shown in their own language. */
const NATIVE_NAMES: Record<Locale, string> = { ka: 'ქართული', en: 'English', ru: 'Русский' };

function useSwitch() {
  return React.useCallback((target: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
    // full navigation: <html lang>, metadata and all server-rendered text change with the locale
    window.location.assign(switchLocaleHref(window.location, target));
  }, []);
}

/** Hrefs for SSR/no-JS (and crawlers); click handler also persists the choice in the `lk_locale` cookie. */
function useHrefs() {
  const [hrefs, setHrefs] = React.useState<Record<Locale, string>>({ ka: '/', en: '/en', ru: '/ru' });
  React.useEffect(() => {
    setHrefs({ ka: switchLocaleHref(window.location, 'ka'), en: switchLocaleHref(window.location, 'en'), ru: switchLocaleHref(window.location, 'ru') });
  }, []);
  return hrefs;
}

export function LanguageSwitcher() {
  const t = useTranslations('common.language');
  const locale = toLocale(useLocale());
  const go = useSwitch();
  const hrefs = useHrefs();
  return (
    <Popover
      align="end"
      className="w-48 p-1"
      trigger={
        <IconButton label={`${t('label')}: ${NATIVE_NAMES[locale]}`} size="sm">
          <Languages className="size-4" strokeWidth={1.5} />
        </IconButton>
      }
    >
      <ul>
        {LOCALES.map((l) => (
          <li key={l}>
            <a
              href={hrefs[l]}
              hrefLang={l}
              lang={l}
              onClick={(e) => {
                e.preventDefault();
                go(l);
              }}
              aria-current={locale === l ? 'true' : undefined}
              className="flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-left text-[15px] hover:bg-surface-2 aria-[current=true]:font-semibold"
            >
              {NATIVE_NAMES[l]}
              {locale === l && <Check className="size-4 text-muted" strokeWidth={1.5} aria-hidden />}
            </a>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/** Inline variant for the mobile drawer. */
export function LanguageLinks({ className }: { className?: string }) {
  const t = useTranslations('common.language');
  const locale = toLocale(useLocale());
  const go = useSwitch();
  const hrefs = useHrefs();
  return (
    <nav aria-label={t('label')} className={cn('flex gap-2', className)}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={hrefs[l]}
          hrefLang={l}
          lang={l}
          onClick={(e) => {
            e.preventDefault();
            go(l);
          }}
          aria-current={locale === l ? 'true' : undefined}
          className="rounded-button border border-border px-3 py-1.5 text-[15px] hover:bg-surface-2 aria-[current=true]:border-border-strong aria-[current=true]:font-semibold"
        >
          {NATIVE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}
