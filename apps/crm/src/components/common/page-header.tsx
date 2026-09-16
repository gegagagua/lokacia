import * as React from 'react';
import { cn } from '@lokacia/ui';

/** Page title bar for CRM screens: compact heading, optional subtitle and actions (right). */
export function PageHeader({ title, subtitle, actions, className, back }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string; back?: React.ReactNode }) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {back && <div className="mb-1 text-small">{back}</div>}
        <h1 className="compact truncate text-[26px] font-semibold leading-8 md:text-h2">{title}</h1>
        {subtitle && <p className="mt-0.5 text-small text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
