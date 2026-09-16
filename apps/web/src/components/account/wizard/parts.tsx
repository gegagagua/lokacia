'use client';
import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@lokacia/ui';
import { IconTile, type Tone } from '../ui';

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export function StepSection({ title, hint, children, className, icon, tone = 'primary', action }: { title: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string; icon?: IconType; tone?: Tone; action?: React.ReactNode }) {
  return (
    <section className={cn('card p-5 sm:p-8', className)}>
      <div className="flex items-start gap-4">
        {icon && <IconTile icon={icon} tone={tone} className="hidden sm:grid" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold leading-8 tracking-tight">{title}</h2>
          {hint && <p className="mt-1 text-[15px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** Small group heading inside a step card. */
export function GroupLabel({ children, required, hint, as: As = 'div' }: { children: React.ReactNode; required?: boolean; hint?: React.ReactNode; as?: 'div' | 'legend' }) {
  return (
    <As className={cn('mb-3 block', As === 'legend' && 'pr-16')}>
      <span className="text-[15px] font-semibold">
        {children} {required && <span className="text-danger" aria-hidden>*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-small font-normal text-muted">{hint}</span>}
    </As>
  );
}

/** Yes / no / unknown for boolean passport fields (unknown ≠ no). */
export function TriState({ id, value, onChange, yes, no, invalid, describedBy }: { id?: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void; yes: string; no: string; invalid?: boolean; describedBy?: string }) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(value === v ? null : v)}
      className={cn('inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none', value === v ? (v ? 'bg-primary text-primary-contrast shadow-sm' : 'bg-surface text-text shadow-sm ring-1 ring-border-strong') : 'text-muted hover:text-text')}
    >
      {value === v && v && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
      {label}
    </button>
  );
  return (
    <div id={id} role="group" aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn('inline-flex w-fit gap-1 rounded-full bg-surface-2 p-1', invalid && 'ring-2 ring-danger/60')}>
      {opt(true, yes)}
      {opt(false, no)}
    </div>
  );
}

export function ChipToggle({ selected, onClick, children, disabled, icon: Icon }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; icon?: IconType }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn('inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14.5px] font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none disabled:opacity-40', selected ? 'border-primary bg-primary text-primary-contrast shadow-sm' : 'border-border bg-surface shadow-xs hover:border-border-strong hover:bg-surface-2')}
    >
      {Icon && <Icon className="size-4" strokeWidth={2} />}
      {children}
    </button>
  );
}

/** Large selectable tile (business type / deal type / role). */
export function OptionTile({ selected, onClick, disabled, icon: Icon, title, description, role, compact }: { selected: boolean; onClick: () => void; disabled?: boolean; icon: IconType; title: React.ReactNode; description?: React.ReactNode; role?: 'radio'; compact?: boolean }) {
  return (
    <button
      type="button"
      role={role}
      {...(role === 'radio' ? { 'aria-checked': selected } : { 'aria-pressed': selected })}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl border bg-surface text-left transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        compact ? 'flex-col justify-center px-3 py-4 text-center' : 'p-4',
        selected ? 'border-primary bg-primary-soft/60 shadow-sm ring-1 ring-primary' : 'border-border shadow-xs hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
      )}
    >
      <span className={cn('grid shrink-0 place-items-center rounded-xl transition-colors', compact ? 'size-12' : 'size-11', selected ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-primary-soft-text group-hover:bg-primary-soft')} aria-hidden>
        <Icon className={compact ? 'size-6' : 'size-5'} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className={cn('block font-semibold leading-snug', compact ? 'text-[14px]' : 'text-[15.5px]')}>{title}</span>
        {description && <span className="mt-0.5 block text-small text-muted">{description}</span>}
      </span>
      {selected && (
        <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-contrast" aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Read-only info tile (district, coordinates…). */
export function InfoTile({ label, children, icon: Icon }: { label: React.ReactNode; children: React.ReactNode; icon?: IconType }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-primary-soft-text shadow-xs" aria-hidden>
          <Icon className="size-4" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-muted">{label}</div>
        <div className="truncate text-[15px] font-semibold">{children}</div>
      </div>
    </div>
  );
}
