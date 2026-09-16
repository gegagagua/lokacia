import * as React from 'react';

/** Account page title row: optional back link / eyebrow, bold title, muted subtitle, actions on the right. */
export function AccountPageHeader({ title, description, actions, back, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <div className="mb-3 text-small font-medium">{back}</div>}
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="text-[28px] font-bold leading-9 tracking-tight sm:text-[34px] sm:leading-[42px]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-[15.5px] text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
