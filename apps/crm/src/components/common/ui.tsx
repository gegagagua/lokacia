import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@lokacia/ui';

/**
 * CRM v2 design primitives (modern SaaS look). Colours come from semantic tokens + the categorical
 * tone palette in globals.css (`tone-1..8`, `tone-primary|danger|success|accent|link`).
 */
export type Tone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'primary' | 'danger' | 'success' | 'accent' | 'link' | 'neutral';

export const toneClass = (tone: Tone = 'primary') => (tone === 'neutral' ? 'tone-8' : `tone-${tone}`);

/** Stable tone for any string (avatars, tags, channels, stages without explicit colour). */
export function toneFor(key: string | null | undefined): Exclude<Tone, 'neutral'> {
  const s = key ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ((h % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Tinted square icon tile. */
export function IconTile({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'size-8 rounded-[10px]' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl';
  const ic = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5';
  return (
    <span className={cn('grid shrink-0 place-items-center bg-tone-soft text-tone-ink', toneClass(tone), dim, className)} aria-hidden>
      <Icon className={ic} strokeWidth={2} />
    </span>
  );
}

/** Coloured initials avatar (falls back when there is no photo); deterministic tone per name. */
export function PersonAvatar({ name, src, size = 32, className, ring }: { name?: string | null; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const initials =
    (name ?? '?')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-surface', className)} style={style} />;
  return (
    <span aria-hidden className={cn('inline-grid shrink-0 select-none place-items-center rounded-full bg-tone-soft font-semibold leading-none text-tone-ink', toneClass(toneFor(name)), ring && 'ring-2 ring-surface', className)} style={style}>
      {initials}
    </span>
  );
}

/** Overlapping avatars. */
export function AvatarStack({ names, max = 4, size = 26 }: { names: (string | null | undefined)[]; max?: number; size?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <PersonAvatar key={i} name={n} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="inline-grid place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Rounded pill with optional status dot. */
export function Pill({ tone = 'neutral', dot, icon: Icon, children, className, size = 'md' }: { tone?: Tone; dot?: boolean; icon?: LucideIcon; children: React.ReactNode; className?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none',
        size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-7 px-2.5 text-[12.5px]',
        tone === 'neutral' ? 'bg-surface-2 text-muted ring-1 ring-inset ring-border' : cn('bg-tone-soft text-tone-ink', toneClass(tone)),
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', tone === 'neutral' ? 'bg-border-strong' : 'bg-tone')} />}
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** KPI card: icon tile, big number, optional trend and hint. */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  trend,
  href,
  className,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  trend?: { value: string; up: boolean; good?: boolean } | null;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-[13.5px] font-medium leading-5 text-muted">{label}</div>
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[28px] font-bold leading-9 tracking-tight tabular">{value}</span>
        {trend && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold tabular', (trend.good ?? trend.up) ? 'bg-success/12 text-success' : 'bg-danger/10 text-danger')}>
            {trend.up ? <ArrowUpRight className="size-3.5" strokeWidth={2.2} aria-hidden /> : <ArrowDownRight className="size-3.5" strokeWidth={2.2} aria-hidden />}
            {trend.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[13px] leading-5 text-muted">{hint}</div>}
      {children}
    </>
  );
  const cls = cn('card relative block overflow-hidden p-4 md:p-5', href && 'card-hover focus-visible:shadow-ring focus-visible:outline-none', className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Card with a header row (icon, title, description, action). */
export function SectionCard({
  title,
  description,
  icon,
  tone,
  action,
  children,
  className,
  bodyClassName,
  as: As = 'section',
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: React.ElementType;
  id?: string;
}) {
  const headingId = React.useId();
  return (
    <As id={id} className={cn('card min-w-0', className)} aria-labelledby={title ? headingId : undefined}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <IconTile icon={icon} tone={tone} size="sm" className="mt-0.5" />}
            <div className="min-w-0">
              {title && (
                <h2 id={headingId} className="text-[16px] font-semibold leading-6">
                  {title}
                </h2>
              )}
              {description && <p className="text-[13.5px] leading-5 text-muted">{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('p-4 md:p-5', bodyClassName)}>{children}</div>
    </As>
  );
}

/** Pill filter chips (single or multi select, rendered as toggle buttons). */
export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: V; label: React.ReactNode; count?: number; icon?: LucideIcon; tone?: Tone }[];
  value: V | V[];
  onChange: (v: V) => void;
  label: string;
  className?: string;
}) {
  const selected = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role="group" aria-label={label} className={cn('scrollbar-none -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5', className)}>
      {options.map((o) => {
        const on = selected(o.value);
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
              on ? 'border-transparent bg-text text-surface shadow-sm' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text',
            )}
          >
            {o.tone && !Icon && <span aria-hidden className={cn('size-2 rounded-full bg-tone', toneClass(o.tone))} />}
            {Icon && <Icon className="size-3.5" strokeWidth={2} aria-hidden />}
            {o.label}
            {o.count != null && <span className={cn('rounded-full px-1.5 text-[11.5px] tabular', on ? 'bg-surface/20' : 'bg-surface-2')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control (view toggles). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: { value: V; label: React.ReactNode; icon?: LucideIcon }[];
  value: V;
  onChange: (v: V) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
              size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3.5 text-[14px]',
              on ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
            )}
          >
            {Icon && <Icon className="size-4" strokeWidth={2} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small progress bar. */
export function Progress({ value, tone = 'primary', className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cn('h-full rounded-full bg-tone transition-[width] duration-500', toneClass(tone))} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Inline empty hint inside cards (lighter than EmptyState). */
export function EmptyHint({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}>
      <IconTile icon={Icon} tone="primary" size="lg" />
      <div className="mt-1 font-semibold">{title}</div>
      {description && <p className="max-w-sm text-[13.5px] text-muted">{description}</p>}
      {action}
    </div>
  );
}

/** Toolbar row that sits between the page header and content. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>{children}</div>;
}
