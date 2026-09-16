'use client';
import * as React from 'react';

export function JsonView({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = React.useState(false);
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  return (
    <div>
      <button type="button" className="text-small text-link hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && <pre className="mt-1 max-h-72 max-w-[min(640px,80vw)] overflow-auto rounded-[6px] border border-border bg-surface-2 p-2 font-mono text-[12px] leading-5">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}
