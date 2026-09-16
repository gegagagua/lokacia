import * as React from 'react';
import { Avatar as RAvatar } from 'radix-ui';
import { BadgeCheck, Sparkles, Inbox } from 'lucide-react';
import { cn } from '../lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'link' | 'danger' | 'success' | 'outline';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-text',
  primary: 'bg-primary-soft text-primary-soft-text',
  accent: 'bg-accent text-accent-contrast shadow-xs',
  link: 'bg-link/10 text-link',
  danger: 'bg-danger/10 text-danger',
  // Pure --success on its own 12% tint is ~4.2:1 on light bg; nudging toward --text keeps AA in both themes.
  success: 'bg-success/12 text-[color-mix(in_srgb,var(--success)_85%,var(--text))]',
  outline: 'bg-transparent text-muted ring-1 ring-inset ring-border-strong',
};

export function Badge({ tone = 'neutral', className, icon, children, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold leading-none', tones[tone], className)} {...p}>
      {icon}
      {children}
    </span>
  );
}

export const VipBadge = () => (
  <Badge tone="accent" icon={<Sparkles className="size-3" strokeWidth={1.5} aria-hidden />}>
    VIP
  </Badge>
);
export const VerifiedBadge = ({ label = 'ვერიფიცირებული მესაკუთრე' }: { label?: string }) => (
  <Badge tone="success" icon={<BadgeCheck className="size-3.5" strokeWidth={1.5} aria-hidden />}>
    {label}
  </Badge>
);

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name?: string | null; size?: number; className?: string }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <RAvatar.Root className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-primary-soft-text ring-2 ring-surface', className)} style={{ width: size, height: size }}>
      {src && <RAvatar.Image src={src} alt={name ?? ''} className="size-full object-cover" />}
      <RAvatar.Fallback className="font-semibold" style={{ fontSize: Math.max(12, Math.round(size * 0.38)) }}>
        {initials}
      </RAvatar.Fallback>
    </RAvatar.Root>
  );
}

export function Card({ className, as: As = 'div', ...p }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return <As className={cn('rounded-card border border-border bg-surface shadow-sm', className)} {...p} />;
}

export function SectionTitle({ title, action, subtitle, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[26px] font-bold leading-tight tracking-tight md:text-h2">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-[17px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action, icon, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong bg-surface px-6 py-14 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text">{icon ?? <Inbox className="size-5" strokeWidth={1.5} aria-hidden />}</div>
      <h3 className="text-h3 font-semibold">{title}</h3>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-[10px] bg-surface-3', className)} {...p} />;
}

/** Numeric spec row: label ····· value unit (tabular). */
export function SpecRow({ label, value, unit, icon, muted, className }: { label: React.ReactNode; value: React.ReactNode; unit?: string; icon?: React.ReactNode; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-2 border-b border-border py-3 last:border-b-0', className)}>
      {icon && <span className="translate-y-0.5 text-muted">{icon}</span>}
      <span className={cn('text-[15px]', muted ? 'text-muted' : 'text-text')}>{label}</span>
      <span aria-hidden className="mx-1 flex-1" />
      <span className="tabular font-semibold">
        {value}
        {unit && <span className="ml-1 text-small font-normal text-muted">{unit}</span>}
      </span>
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border border-border bg-surface p-5 shadow-sm', className)}>
      <div className="text-small font-medium text-muted">{label}</div>
      <div className="mt-1.5 text-[30px] font-bold leading-tight tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 text-small text-muted">{hint}</div>}
    </div>
  );
}

export function Stepper({ steps, current, className, onStepClick }: { steps: string[]; current: number; className?: string; onStepClick?: (i: number) => void }) {
  return (
    <ol className={cn('flex w-full items-center gap-2 overflow-x-auto', className)} aria-label="ნაბიჯები">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!onStepClick || i > current}
              onClick={() => onStepClick?.(i)}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-small font-semibold tabular transition-colors',
                state === 'done' && 'bg-primary text-primary-contrast',
                state === 'current' && 'bg-primary-soft text-primary-soft-text ring-2 ring-primary',
                state === 'todo' && 'bg-surface-2 text-muted',
              )}
            >
              {i + 1}
            </button>
            <span className={cn('hidden truncate text-small md:inline', state === 'todo' ? 'text-muted' : 'text-text')}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className={cn('h-0.5 flex-1 rounded-full', i < current ? 'bg-primary' : 'bg-surface-3')} />}
          </li>
        );
      })}
    </ol>
  );
}
