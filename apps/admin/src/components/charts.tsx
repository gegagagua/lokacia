import * as React from 'react';

/** Minimal SVG line/area sparkline (no chart lib — BRAND: technical drawing look). */
export function Sparkline({ values, height = 64, label }: { values: number[]; height?: number; label: string }) {
  const w = 300;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - (v / max) * (height - 8)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label={label}>
      <line x1="0" x2={w} y1={height - 4} y2={height - 4} stroke="var(--border)" />
      {values.length > 0 && <polyline points={pts.join(' ')} fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Vertical bars with labels under each bar. */
export function Bars({ data, format, label }: { data: { label: string; value: number }[]; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure aria-label={label} className="w-full">
      <div className="flex h-44 items-end gap-2 border-b border-border-strong">
        {data.map((d) => (
          <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${format ? format(d.value) : d.value}`}>
            <span className="text-[11px] tabular text-muted">{format ? format(d.value) : d.value}</span>
            <div className="w-full max-w-10 rounded-t-[3px] bg-primary" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center text-[11px] text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal proportion bars (label · bar · value). */
export function HBars({ data, format }: { data: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3 text-small">
          <span className="truncate">{d.label}</span>
          <span className="h-2 rounded-full bg-surface-2">
            <span className="block h-2 rounded-full bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="tabular text-muted">{format ? format(d.value) : d.value}</span>
        </li>
      ))}
    </ul>
  );
}
