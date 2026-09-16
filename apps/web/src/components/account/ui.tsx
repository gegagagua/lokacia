import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@lokacia/ui';

/** Account UI primitives (v2 modern dashboard). Server- and client-safe (no hooks). */

export type Tone = 'primary' | 'accent' | 'link' | 'danger' | 'success' | 'neutral';

const TILE: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary-soft-text',
  accent: 'bg-accent-soft text-[color-mix(in_srgb,var(--accent)_55%,var(--text))]',
  link: 'bg-link/12 text-link',
  danger: 'bg-danger/12 text-danger',
  success: 'bg-success/12 text-success',
  neutral: 'bg-surface-2 text-muted',
};

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;

export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: IconType; tone?: Tone; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dim = { sm: 'size-9 rounded-xl', md: 'size-11 rounded-2xl', lg: 'size-14 rounded-2xl', xl: 'size-16 rounded-[22px]' }[size];
  const ic = { sm: 'size-4', md: 'size-5', lg: 'size-6', xl: 'size-7' }[size];
  return (
    <span className={cn('grid shrink-0 place-items-center', dim, TILE[tone], className)} aria-hidden>
      <Icon className={ic} strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Section card: header row (icon, title, description, action) + body. */
export function SectionCard({ title, description, icon, tone = 'primary', action, children, className, bodyClassName, id, flush }: { title?: React.ReactNode; description?: React.ReactNode; icon?: IconType; tone?: Tone; action?: React.ReactNode; children?: React.ReactNode; className?: string; bodyClassName?: string; id?: string; flush?: boolean }) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className={cn('card overflow-hidden', className)}>
      {title && (
        <header className={cn('flex flex-wrap items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6', flush ? 'border-b border-border pb-4' : '')}>
          {icon && <IconTile icon={icon} tone={tone} size="sm" />}
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-[18px] font-bold leading-7 tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(flush ? '' : 'px-5 pb-5 pt-4 sm:px-6 sm:pb-6', !title && !flush && 'pt-5 sm:pt-6', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Settings-style row: label + description on the left, controls on the right (stacked on mobile). */
export function SettingsRow({ label, description, children, className, htmlFor }: { label: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; htmlFor?: string }) {
  const L = htmlFor ? 'label' : 'div';
  return (
    <div className={cn('grid gap-3 border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8', className)}>
      <div className="min-w-0">
        <L {...(htmlFor ? { htmlFor } : {})} className="block text-[15px] font-semibold">
          {label}
        </L>
        {description && <p className="mt-1 text-small text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Trend({ pct, label, isNew }: { pct: number | null; label?: string; isNew?: string }) {
  if (pct === null && !isNew) return null;
  if (isNew)
    return <span className="inline-flex h-6 items-center gap-1 rounded-full bg-link/10 px-2 text-[12.5px] font-semibold text-link">{isNew}</span>;
  const up = (pct ?? 0) > 0;
  const down = (pct ?? 0) < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[12.5px] font-semibold tabular', up ? 'bg-success/12 text-success' : down ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-muted')}>
      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

/** KPI card: icon tile, big number, label, optional trend/hint. */
export function KpiCard({ icon, tone = 'primary', label, value, hint, trend, className }: { icon: IconType; tone?: Tone; label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; trend?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('card flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <IconTile icon={icon} tone={tone} />
        {trend}
      </div>
      <div>
        <div className="text-[24px] font-bold leading-8 tracking-tight tabular sm:text-[30px] sm:leading-9">{value}</div>
        <div className="mt-1 text-small font-medium text-muted">{label}</div>
        {hint && <div className="mt-1 text-small text-muted">{hint}</div>}
      </div>
    </div>
  );
}

/** Empty state with a large tinted icon tile. */
export function AccountEmpty({ icon, title, description, action, tone = 'primary', className }: { icon: IconType; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cn('card flex flex-col items-center gap-4 px-6 py-14 text-center', className)}>
      <div className="relative">
        <span aria-hidden className="absolute -inset-3 rounded-[28px] bg-primary-soft/50" />
        <IconTile icon={icon} tone={tone} size="xl" className="relative" />
      </div>
      <div>
        <h2 className="text-h3 font-bold">{title}</h2>
        {description && <p className="mx-auto mt-1 max-w-md text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Segmented pill control (radiogroup / tablist semantics chosen by caller). */
export function Segmented<T extends string | number>({ value, onChange, options, label, role = 'radiogroup', className, busy }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; label: string; role?: 'radiogroup' | 'tablist'; className?: string; busy?: boolean }) {
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
  return (
    <div role={role} aria-label={label} aria-busy={busy || undefined} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role={itemRole}
            {...(itemRole === 'tab' ? { 'aria-selected': active } : { 'aria-checked': active })}
            onClick={() => onChange(o.value)}
            className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none', active ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11.5px] tabular', active ? 'bg-primary-soft text-primary-soft-text' : 'bg-surface-3 text-muted')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Photo thumbnail with graceful placeholder. */
export function Thumb({ src, className, alt = '' }: { src: string | null | undefined; className?: string; alt?: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-photo bg-surface-2', className)}>
      {src ? <img src={src} alt={alt} className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]" loading="lazy" /> : <div className="drawing-grid size-full" aria-hidden />}
    </div>
  );
}

/** Date tile: weekday/month on top, big day number. */
export function DateTile({ day, month, className, tone = 'primary' }: { day: React.ReactNode; month: React.ReactNode; className?: string; tone?: 'primary' | 'accent' | 'neutral' }) {
  return (
    <div className={cn('flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-2xl border text-center', tone === 'accent' ? 'border-accent/50 bg-accent-soft' : tone === 'neutral' ? 'border-border bg-surface-2' : 'border-primary/20 bg-primary-soft', className)} aria-hidden>
      <span className={cn('w-full py-0.5 text-[11px] font-semibold', tone === 'accent' ? 'bg-accent text-accent-contrast' : tone === 'neutral' ? 'bg-surface-3 text-muted' : 'bg-primary text-primary-contrast')}>{month}</span>
      <span className="py-1 text-[22px] font-bold leading-7 tabular text-text">{day}</span>
    </div>
  );
}
