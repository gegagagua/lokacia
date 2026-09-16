import * as React from 'react';
import { cn } from '@lokacia/ui';

/** Shared v2 building blocks for billing / developer / finance / property surfaces (server-safe, no hooks). */

export type TileTone = 'primary' | 'accent' | 'link' | 'danger' | 'success' | 'neutral';
const TILE: Record<TileTone, string> = {
  primary: 'bg-primary-soft text-primary-soft-text',
  accent: 'bg-accent-soft text-[#7a5200] dark:text-accent',
  link: 'bg-link/10 text-link',
  danger: 'bg-danger/10 text-danger',
  success: 'bg-success/12 text-success',
  neutral: 'bg-surface-2 text-muted',
};

export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>; tone?: TileTone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'sm' ? 'size-9 rounded-xl' : size === 'lg' ? 'size-14 rounded-2xl' : 'size-11 rounded-2xl';
  const ico = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5';
  return (
    <span className={cn('grid shrink-0 place-items-center', box, TILE[tone], className)}>
      <Icon className={ico} strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Marketing page header: eyebrow pill + big title + muted lead; optional actions and aside. */
export function PageHero({ eyebrow, eyebrowIcon, title, lead, actions, aside, center, className }: { eyebrow?: React.ReactNode; eyebrowIcon?: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; actions?: React.ReactNode; aside?: React.ReactNode; center?: boolean; className?: string }) {
  return (
    <header className={cn('relative', aside ? 'grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : '', className)}>
      <div className={cn('min-w-0', center && 'mx-auto max-w-3xl text-center', !center && !aside && 'max-w-3xl')}>
        {eyebrow && (
          <span className="eyebrow">
            {eyebrowIcon}
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 text-[34px] font-bold leading-[1.25] tracking-tight md:text-h1 md:leading-[1.22] lg:text-display lg:leading-[1.16]">{title}</h1>
        {lead && <p className={cn('mt-4 text-[17px] leading-relaxed text-muted md:text-[19px]', center ? 'mx-auto max-w-2xl' : 'max-w-2xl')}>{lead}</p>}
        {actions && <div className={cn('mt-7 flex flex-wrap gap-3', center && 'justify-center')}>{actions}</div>}
      </div>
      {aside && <div className="min-w-0">{aside}</div>}
    </header>
  );
}

/** Section header: optional eyebrow, title, lead and right-aligned action. */
export function SectionHeading({ id, eyebrow, title, lead, action, level = 'h2', className }: { id?: string; eyebrow?: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; action?: React.ReactNode; level?: 'h2' | 'h3'; className?: string }) {
  const H = level;
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
        <H id={id} className={cn('font-bold tracking-tight', level === 'h2' ? 'text-[26px] leading-[34px] md:text-h2' : 'text-[22px] leading-[30px]')}>
          {title}
        </H>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Account-area page header (inside the account shell): icon tile + title + subtitle + actions. */
export function AccountPageHeader({ icon, title, subtitle, actions }: { icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {icon && <IconTile icon={icon} size="lg" className="hidden sm:grid" />}
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-[38px] tracking-tight md:text-[36px] md:leading-[44px]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Styled code block with a window-chrome header (always dark for legibility in both themes). */
export function CodeBlock({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn('min-w-0 overflow-hidden rounded-card border border-[#1f2c27] bg-[#0b1411] shadow-md', className)}>
      <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#f0735a]" />
          <span className="size-2.5 rounded-full bg-[#f0bd3a]" />
          <span className="size-2.5 rounded-full bg-[#4cc3a2]" />
        </span>
        {title && <span className="truncate font-mono text-[13px] text-[#a3b5ae]">{title}</span>}
      </figcaption>
      <pre tabIndex={0} className="overflow-x-auto p-4 text-[13.5px] leading-[1.7] text-[#e6efeb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8fb4f2]">
        <code className="font-mono">{children}</code>
      </pre>
    </figure>
  );
}

/** Small key/value row used in summary cards. */
export function KeyValue({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <dt className="text-muted">{label}</dt>
      <dd className={cn('min-w-0 text-right tabular', strong ? 'font-semibold' : 'font-medium')}>{value}</dd>
    </div>
  );
}
