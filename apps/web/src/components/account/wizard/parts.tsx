'use client';
import * as React from 'react';
import { cn } from '@lokacia/ui';

export function StepSection({ title, hint, children, className }: { title: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-border bg-surface p-4 sm:p-6', className)}>
      <h2 className="compact text-h3 font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

/** Yes / no / unknown for boolean passport fields (unknown ≠ no). */
export function TriState({ id, value, onChange, yes, no, invalid, describedBy }: { id?: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void; yes: string; no: string; invalid?: boolean; describedBy?: string }) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(value === v ? null : v)}
      className={cn('h-9 min-w-16 px-3 text-small transition-colors first:rounded-l-button last:rounded-r-button', value === v ? 'bg-primary text-primary-contrast' : 'bg-surface text-text hover:bg-surface-2')}
    >
      {label}
    </button>
  );
  return (
    <div id={id} role="group" aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn('inline-flex w-fit divide-x divide-border-strong rounded-button border', invalid ? 'border-danger' : 'border-border-strong')}>
      {opt(true, yes)}
      {opt(false, no)}
    </div>
  );
}

export function ChipToggle({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn('inline-flex h-9 items-center rounded-button border px-3 text-small transition-colors disabled:opacity-40', selected ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:bg-surface-2')}
    >
      {children}
    </button>
  );
}
