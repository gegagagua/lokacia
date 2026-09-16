'use client';
import * as React from 'react';
import { cn } from '@lokacia/ui';

/**
 * Hand-made charts in the cadastral-drawing style: hairline borders, primary green marks, tabular labels,
 * no gradients/shadows. Every chart exposes its data as a visually hidden table for screen readers.
 */
export type BarDatum = { key: string; label: string; value: number; display: string; tone?: 'primary' | 'success' | 'danger' | 'muted' };

const toneClass = { primary: 'bg-primary', success: 'bg-success', danger: 'bg-danger', muted: 'bg-border-strong' } as const;

export function HBarChart({ data, caption, valueHeader, className }: { data: BarDatum[]; caption: string; valueHeader: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className={cn('flex flex-col gap-1.5', className)}>
      <div aria-hidden className="flex flex-col gap-1.5">
        {data.map((d) => (
          <div key={d.key} className="grid grid-cols-[minmax(80px,140px)_1fr_auto] items-center gap-2 text-small">
            <span className="truncate text-muted">{d.label}</span>
            <span className="relative h-5 border-l border-border-strong">
              <span className={cn('absolute inset-y-0.5 left-0 rounded-r-[2px]', toneClass[d.tone ?? 'primary'])} style={{ width: `${Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * 100)}%` }} />
            </span>
            <span className="tabular font-medium">{d.display}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>
                {valueHeader}: {d.display}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Vertical column chart with a dimension-line baseline (monthly series). */
export function ColumnChart({ data, caption, height = 160, className }: { data: BarDatum[]; caption: string; height?: number; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const w = 100 / n;
  return (
    <figure className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" className="h-[var(--h)] w-full" style={{ ['--h' as string]: `${height}px` }} aria-hidden>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2="100" y1={(height / 2) * g} y2={(height / 2) * g} stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 2 - 2);
          return <rect key={d.key} x={i * w + w * 0.22} width={w * 0.56} y={height / 2 - h} height={h} fill={d.tone === 'muted' ? 'var(--border-strong)' : 'var(--primary)'} />;
        })}
        <line x1="0" x2="100" y1={height / 2} y2={height / 2} stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid text-center text-[11px] text-muted tabular" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d) => (
          <div key={d.key} className="flex flex-col border-l border-dashed border-border first:border-l-0">
            <span className="font-medium text-text">{d.display}</span>
            <span>{d.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
