import * as React from 'react';
import Link from 'next/link';
import { Avatar, cn } from '@lokacia/ui';

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */
export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'danger' | 'info';

const pillTone: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted ring-border',
  primary: 'bg-primary-soft text-primary-soft-text ring-primary/15',
  accent: 'bg-accent-soft text-[#7a5500] ring-accent/30 dark:text-accent',
  success: 'bg-success/10 text-[color-mix(in_srgb,var(--success)_85%,var(--text))] ring-success/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-link/10 text-link ring-link/20',
};
const dotTone: Record<Tone, string> = {
  neutral: 'bg-border-strong',
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  info: 'bg-link',
};

/** Status pill with a leading dot. */
export function StatusPill({ tone = 'neutral', children, className, dot = true, pulse }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean; pulse?: boolean }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold leading-none ring-1 ring-inset', pillTone[tone], className)}>
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', dotTone[tone])} />}
          <span className={cn('relative inline-flex size-1.5 rounded-full', dotTone[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

/** Tinted rounded icon tile. */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: React.ElementType; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary-soft-text',
    accent: 'bg-accent-soft text-[#8a6200] dark:text-accent',
    success: 'bg-success/10 text-[color-mix(in_srgb,var(--success)_85%,var(--text))]',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-link/10 text-link',
  };
  const sizes = { sm: 'size-8 rounded-lg [&>svg]:size-4', md: 'size-10 rounded-xl [&>svg]:size-[18px]', lg: 'size-12 rounded-2xl [&>svg]:size-[22px]' };
  return (
    <span className={cn('grid shrink-0 place-items-center', tones[tone], sizes[size], className)}>
      <Icon strokeWidth={2} aria-hidden />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* KPI card                                                            */
/* ------------------------------------------------------------------ */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  children,
  href,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ElementType;
  tone?: Tone;
  children?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-snug text-muted sm:text-small">{label}</div>
          <div className="mt-2 text-[22px] font-bold leading-none tracking-tight tabular sm:text-[28px] xl:text-[30px]">{value}</div>
        </div>
        <IconTile icon={icon} tone={tone} className="hidden sm:grid" />
      </div>
      {hint && <div className="mt-2.5 text-[13px] leading-snug text-muted sm:text-small">{hint}</div>}
      {children && <div className="mt-3">{children}</div>}
    </>
  );
  const cls = cn('card relative block min-w-0 overflow-hidden p-4 sm:p-5', href && 'card-hover focus-visible:shadow-ring focus-visible:outline-none', className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Small trend chip (+12%). */
export function Trend({ value, suffix = '%', invert }: { value: number; suffix?: string; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular', good ? 'bg-success/10 text-[color-mix(in_srgb,var(--success)_85%,var(--text))]' : 'bg-danger/10 text-danger')}>
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */
export const th = 'whitespace-nowrap px-4 py-3 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6';
export const td = 'px-4 py-3.5 align-middle first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6';
export const tr = 'border-t border-border transition-colors hover:bg-surface-2/60';

/** Card that scrolls its table horizontally inside itself (never the page). */
export function TableCard({ children, className, minWidth = 720, label, toolbar, footer, flat }: { children: React.ReactNode; className?: string; minWidth?: number; label?: string; toolbar?: React.ReactNode; footer?: React.ReactNode; flat?: boolean }) {
  return (
    <div className={cn(flat ? 'min-w-0' : 'card min-w-0 overflow-hidden', className)}>
      {toolbar && <div className="border-b border-border px-4 py-3 md:px-5">{toolbar}</div>}
      <div className="max-w-full overflow-x-auto overscroll-x-contain" role={label ? 'region' : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
        <table className="w-full border-collapse text-left text-[14.5px] tabular" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-2/70">
      <tr>{children}</tr>
    </thead>
  );
}

/** Avatar + name (+ sub line) cell. */
export function Person({ name, sub, href, size = 36, className, extra }: { name: string | null | undefined; sub?: React.ReactNode; href?: string; size?: number; className?: string; extra?: React.ReactNode }) {
  const label = name ?? '—';
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar name={label} size={size} className="ring-0" />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {href ? (
            <Link href={href} className="truncate font-semibold text-text hover:text-link hover:underline">
              {label}
            </Link>
          ) : (
            <span className="truncate font-semibold">{label}</span>
          )}
          {extra}
        </div>
        {sub && <div className="truncate text-small text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */
/** Horizontal pill filter (single choice). Scrolls on narrow screens. */
export function PillFilter<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
              on ? 'bg-text text-bg shadow-sm' : 'bg-surface text-muted ring-1 ring-inset ring-border hover:text-text hover:ring-border-strong',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('rounded-full px-1.5 text-[12px] tabular', on ? 'bg-bg/20' : 'bg-surface-2')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filter toolbar card. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('card mb-5 flex flex-wrap items-center gap-3 p-3 md:p-3.5', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */
export function InlineEmpty({ icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2/50 px-4 py-4 text-small text-muted">
      {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

/** Key/value grid (definition list). */
export function KeyValues({ items, className, cols = 2 }: { items: { label: React.ReactNode; value: React.ReactNode; wide?: boolean }[]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-3', cols === 2 && 'grid-cols-2', cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0 rounded-2xl bg-surface-2/70 px-4 py-3', it.wide && 'col-span-full')}>
          <dt className="text-[13px] font-medium text-muted">{it.label}</dt>
          <dd className="mt-0.5 font-semibold tabular [overflow-wrap:anywhere]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Price vs district average indicator: a centered track with a marker. */
export function DeltaMeter({ pct, label, className, showValue = true }: { pct: number | null; label: string; className?: string; showValue?: boolean }) {
  if (pct === null) {
    return (
      <div className={cn('text-small text-muted', className)} aria-label={label}>
        —
      </div>
    );
  }
  const clamped = Math.max(-60, Math.min(60, pct));
  const pos = 50 + (clamped / 60) * 50;
  const abs = Math.abs(pct);
  const tone = abs > 30 ? 'danger' : abs > 15 ? 'accent' : 'success';
  const color = { danger: 'bg-danger', accent: 'bg-accent', success: 'bg-success' }[tone];
  const text = { danger: 'text-danger', accent: 'text-[#8a6200] dark:text-accent', success: 'text-[color-mix(in_srgb,var(--success)_85%,var(--text))]' }[tone];
  return (
    <div className={cn('min-w-0', className)} role="img" aria-label={`${label}: ${pct > 0 ? '+' : ''}${pct}%`}>
      {showValue && (
        <div className={cn('mb-1.5 text-[15px] font-bold tabular', text)}>
          {pct > 0 ? '+' : ''}
          {pct}%
        </div>
      )}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-danger/25 via-success/30 to-danger/25">
        <span className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-y-1/2 bg-border-strong" aria-hidden />
        <span className={cn('absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface shadow-sm', color)} style={{ left: `${pos}%` }} aria-hidden />
      </div>
    </div>
  );
}

/** Progress bar with gradient fill. */
export function Meter({ value, max, tone = 'primary', className }: { value: number; max: number; tone?: 'primary' | 'accent' | 'danger' | 'success'; className?: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  const fill = {
    primary: 'from-primary-500 to-primary',
    accent: 'from-[#f3cf6a] to-accent',
    danger: 'from-danger/60 to-danger',
    success: 'from-success/60 to-success',
  }[tone];
  return (
    <span className={cn('block h-2 overflow-hidden rounded-full bg-surface-3', className)} aria-hidden>
      <span className={cn('block h-full rounded-full bg-gradient-to-r', fill)} style={{ width: `${pct}%` }} />
    </span>
  );
}
