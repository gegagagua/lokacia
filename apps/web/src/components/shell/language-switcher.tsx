'use client';
import * as React from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn, Popover } from '@lokacia/ui';
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

const CODES: Record<Locale, string> = { ka: 'KA', en: 'EN', ru: 'RU' };

export function LanguageSwitcher() {
  const t = useTranslations('common.language');
  const locale = toLocale(useLocale());
  const go = useSwitch();
  const hrefs = useHrefs();
  const [open, setOpen] = React.useState(false);
  return (
    <Popover
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="w-60 p-1.5"
      trigger={
        <button
          type="button"
          aria-label={`${t('label')}: ${NATIVE_NAMES[locale]}`}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface pl-2.5 pr-2 text-[13px] font-semibold text-text shadow-xs transition-all hover:border-border-strong hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none',
            open && 'border-border-strong bg-surface-2',
          )}
        >
          <Globe className="size-4 text-muted" strokeWidth={2} aria-hidden />
          <span className="tabular tracking-wide">{CODES[locale]}</span>
          <ChevronDown className={cn('size-3.5 text-muted transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.25} aria-hidden />
        </button>
      }
    >
      <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{t('label')}</p>
      <ul className="flex flex-col gap-0.5">
        {LOCALES.map((l) => {
          const active = locale === l;
          return (
            <li key={l}>
              <a
                href={hrefs[l]}
                hrefLang={l}
                lang={l}
                onClick={(e) => {
                  e.preventDefault();
                  go(l);
                }}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-primary-soft' : 'hover:bg-surface-2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tracking-wide transition-colors',
                    active ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-muted group-hover:bg-surface-3 group-hover:text-text',
                  )}
                >
                  {CODES[l]}
                </span>
                <span className={cn('flex-1 text-[15px]', active ? 'font-semibold text-primary-soft-text' : 'font-medium text-text')}>{NATIVE_NAMES[l]}</span>
                {active && <Check className="size-4 text-primary-soft-text" strokeWidth={2.5} aria-hidden />}
              </a>
            </li>
          );
        })}
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
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-3.5 text-[14px] font-medium shadow-xs transition-colors hover:bg-surface-2 aria-[current=true]:border-transparent aria-[current=true]:bg-primary-soft aria-[current=true]:font-semibold aria-[current=true]:text-primary-soft-text"
        >
          <span aria-hidden className={cn('grid size-6 place-items-center rounded-full text-[10.5px] font-bold', locale === l ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-muted')}>
            {CODES[l]}
          </span>
          {NATIVE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}
