'use client';
import * as React from 'react';
import { Braces, ChevronDown } from 'lucide-react';
import { cn } from '@lokacia/ui';

export function JsonView({ value, label }: { value: unknown; label: string }) {
  const [open, setOpen] = React.useState(false);
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  return (
    <div className="min-w-0">
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-link transition-colors hover:bg-surface-3 focus-visible:shadow-ring focus-visible:outline-none"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Braces className="size-3.5" strokeWidth={2} aria-hidden />
        {label}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <pre className="mt-2 max-h-72 max-w-[min(640px,calc(100vw-80px))] overflow-auto rounded-xl border border-border bg-[#0f1a17] p-3 font-mono text-[12.5px] leading-5 text-[#cfe9df] dark:bg-black/40">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
