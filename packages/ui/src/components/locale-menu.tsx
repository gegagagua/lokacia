'use client';
import * as React from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { cn } from '../lib/cn';
import { Popover } from './overlay';

export type MenuLocale = 'ka' | 'en' | 'ru';
const LOCALES: MenuLocale[] = ['ka', 'en', 'ru'];
const NATIVE: Record<MenuLocale, string> = { ka: 'ქართული', en: 'English', ru: 'Русский' };
const CODES: Record<MenuLocale, string> = { ka: 'KA', en: 'EN', ru: 'RU' };

/** Language picker: pill trigger with locale code + menu with code badges (shared by CRM/admin; web has a link variant). */
export function LocaleMenu({ locale, label, onSelect, className }: { locale: MenuLocale; label: string; onSelect: (l: MenuLocale) => void; className?: string }) {
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
          aria-label={`${label}: ${NATIVE[locale]}`}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface pl-2.5 pr-2 text-[13px] font-semibold text-text shadow-xs transition-all hover:border-border-strong hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none',
            open && 'border-border-strong bg-surface-2',
            className,
          )}
        >
          <Globe className="size-4 text-muted" strokeWidth={2} aria-hidden />
          <span className="tabular tracking-wide">{CODES[locale]}</span>
          <ChevronDown className={cn('size-3.5 text-muted transition-transform duration-200', open && 'rotate-180')} strokeWidth={2.25} aria-hidden />
        </button>
      }
    >
      <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {LOCALES.map((l) => {
          const active = locale === l;
          return (
            <li key={l}>
              <button
                type="button"
                lang={l}
                onClick={() => onSelect(l)}
                aria-current={active ? 'true' : undefined}
                className={cn('group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', active ? 'bg-primary-soft' : 'hover:bg-surface-2')}
              >
                <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tracking-wide transition-colors', active ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-muted group-hover:bg-surface-3 group-hover:text-text')}>
                  {CODES[l]}
                </span>
                <span className={cn('flex-1 text-[15px]', active ? 'font-semibold text-primary-soft-text' : 'font-medium text-text')}>{NATIVE[l]}</span>
                {active && <Check className="size-4 text-primary-soft-text" strokeWidth={2.5} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
