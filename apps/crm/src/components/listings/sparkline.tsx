import * as React from 'react';
import { cn } from '@lokacia/ui';

/** Smooth area sparkline with a soft gradient fill and the last value marked. */
export function Sparkline({ values, className, label, height = 40, width = 160, color = 'var(--primary-500)' }: { values: number[]; className?: string; label: string; height?: number; width?: number; color?: string }) {
  const gid = `spark-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 8);
  const pts = values.map((v, i) => [i * step, y(v)] as const);
  const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${line} L${width},${height} L0,${height} Z` : '';
  const last = pts.at(-1);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={label} className={cn('overflow-visible', className)}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {pts.length > 1 && (
        <>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill="var(--surface)" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
