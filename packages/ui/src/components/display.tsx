import * as React from 'react';
import { Avatar as RAvatar } from 'radix-ui';
import { BadgeCheck, Sparkles, Inbox } from 'lucide-react';
import { cn } from '../lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'link' | 'danger' | 'success' | 'outline';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-text border-border',
  primary: 'bg-primary/10 text-primary border-primary/30',
  accent: 'bg-accent text-accent-contrast border-accent',
  link: 'bg-link/10 text-link border-link/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  success: 'bg-success/10 text-success border-success/30',
  outline: 'bg-transparent text-muted border-border-strong',
};

export function Badge({ tone = 'neutral', className, icon, children, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[4px] border px-2 text-[12px] font-medium leading-none', tones[tone], className)} {...p}>
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
    <RAvatar.Root className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-muted', className)} style={{ width: size, height: size }}>
      {src && <RAvatar.Image src={src} alt={name ?? ''} className="size-full object-cover" />}
      <RAvatar.Fallback className="text-small font-medium">{initials}</RAvatar.Fallback>
    </RAvatar.Root>
  );
}

export function Card({ className, as: As = 'div', ...p }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return <As className={cn('rounded-card border border-border bg-surface', className)} {...p} />;
}

export function SectionTitle({ title, action, subtitle, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-h3 font-semibold md:text-h2">{title}</h2>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action, icon, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('drawing-grid flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-12 text-center', className)}>
      <div className="grid size-12 place-items-center rounded-full border border-border-strong bg-surface text-muted">{icon ?? <Inbox className="size-5" strokeWidth={1.5} aria-hidden />}</div>
      <h3 className="text-h3 font-semibold">{title}</h3>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-[4px] bg-surface-2', className)} {...p} />;
}

/** Numeric spec row: label ····· value unit (tabular). */
export function SpecRow({ label, value, unit, icon, muted, className }: { label: React.ReactNode; value: React.ReactNode; unit?: string; icon?: React.ReactNode; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-2 border-b border-border py-2 last:border-b-0', className)}>
      {icon && <span className="translate-y-0.5 text-muted">{icon}</span>}
      <span className={cn('text-[15px]', muted ? 'text-muted' : 'text-text')}>{label}</span>
      <span aria-hidden className="mx-1 flex-1 translate-y-[-3px] border-b border-dotted border-border-strong" />
      <span className="tabular font-medium">
        {value}
        {unit && <span className="ml-1 text-small font-normal text-muted">{unit}</span>}
      </span>
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-card border border-border bg-surface p-4', className)}>
      <div className="text-small text-muted">{label}</div>
      <div className="compact mt-1 text-h2 font-semibold tabular">{value}</div>
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
                'grid size-7 shrink-0 place-items-center rounded-full border text-small tabular',
                state === 'done' && 'border-primary bg-primary text-primary-contrast',
                state === 'current' && 'border-primary text-primary',
                state === 'todo' && 'border-border-strong text-muted',
              )}
            >
              {i + 1}
            </button>
            <span className={cn('hidden truncate text-small md:inline', state === 'todo' ? 'text-muted' : 'text-text')}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className={cn('h-px flex-1', i < current ? 'bg-primary' : 'bg-border-strong')} />}
          </li>
        );
      })}
    </ol>
  );
}
