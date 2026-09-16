import { cn } from '@lokacia/ui';

/** Tiny drawing-style chart: thin polyline over a baseline, last value marked. No axes, tabular label. */
export function Sparkline({ values, className, label, height = 40, width = 160 }: { values: number[]; className?: string; label: string; height?: number; width?: number }) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.at(-1) ?? 0;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={label} className={cn('overflow-visible', className)}>
      <line x1={0} x2={width} y1={height - 4} y2={height - 4} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      {values.length > 1 && <polyline points={pts} fill="none" stroke="var(--link)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
      {values.length > 0 && <circle cx={(values.length - 1) * step} cy={y(last)} r={2.5} fill="var(--accent)" />}
    </svg>
  );
}
