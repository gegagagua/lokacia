import * as React from 'react';
import { cn } from '@lokacia/ui';

export type IconTone = 'primary' | 'accent' | 'link' | 'danger' | 'success' | 'neutral';

export const TONE_TILE: Record<IconTone, string> = {
  primary: 'bg-primary-soft text-primary-soft-text',
  accent: 'bg-accent-soft text-text',
  link: 'bg-link/10 text-link',
  danger: 'bg-danger/10 text-danger',
  success: 'bg-success/12 text-success',
  neutral: 'bg-surface-2 text-muted',
};

/** Tinted rounded icon tile (brand v2). */
export function IconTile({ children, tone = 'primary', size = 'md', className }: { children: React.ReactNode; tone?: IconTone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center', size === 'sm' ? 'size-9 rounded-xl' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-11 rounded-2xl', TONE_TILE[tone], className)}>
      {children}
    </span>
  );
}

/** Listing detail section card: icon tile + title + subtitle + optional action, then content. */
export function ListingSection({
  id,
  title,
  subtitle,
  icon,
  tone = 'primary',
  action,
  children,
  className,
  bare,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: IconTone;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** no card chrome (content provides its own cards) */
  bare?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn('scroll-mt-28', !bare && 'card p-5 md:p-7', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon && <IconTile tone={tone}>{icon}</IconTile>}
          <div className="min-w-0">
            <h2 id={id} className="text-[22px] font-bold leading-tight tracking-tight md:text-[24px]">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Segmented pill control (radiogroup). */
export function Segmented<T extends string | number>({ options, value, onChange, label, disabled, className }: { options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full rounded-full bg-surface-2 p-1', disabled && 'opacity-50', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 flex-1 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold tabular transition-all duration-200 ease-out focus-visible:shadow-ring focus-visible:outline-none',
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
