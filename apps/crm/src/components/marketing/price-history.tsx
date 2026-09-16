import * as React from 'react';
import { formatMoney, formatDateKa, type CompetitorPriceChange } from '@lokacia/contracts';

/** Step chart of competitor price changes (oldest → newest) with a gradient area and our price as a dashed reference. */
export function PriceHistoryChart({ changes, ourPriceMinor, label }: { changes: CompetitorPriceChange[]; ourPriceMinor: number | null; label: string }) {
  const gid = `ph-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pts = [...changes].reverse();
  if (!pts.length) return null;
  const W = 320;
  const H = 140;
  const values = [...pts.map((p) => p.newPriceMinor), ...(ourPriceMinor ? [ourPriceMinor] : [])];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pad = (max - min) * 0.15 || max * 0.1 || 1;
  const y = (v: number) => H - 16 - ((v - (min - pad)) / (max + pad - (min - pad))) * (H - 32);
  const x = (i: number) => (pts.length === 1 ? W / 2 : 8 + (i / (pts.length - 1)) * (W - 16));
  let d = '';
  pts.forEach((p, i) => {
    d += i === 0 ? `M${x(i)},${y(p.newPriceMinor)}` : `H${x(i)}V${y(p.newPriceMinor)}`;
  });
  const lastX = x(pts.length - 1);
  const area = `${d} H${pts.length === 1 ? W - 8 : lastX} V${H} H${pts.length === 1 ? 8 : x(0)} Z`;
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--tone-2)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--tone-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeDasharray="2 4" strokeWidth={1} />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        {ourPriceMinor ? (
          <>
            <line x1={0} x2={W} y1={y(ourPriceMinor)} y2={y(ourPriceMinor)} stroke="var(--primary-500)" strokeDasharray="5 4" strokeWidth={1.5} />
            <text x={W - 4} y={y(ourPriceMinor) - 5} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--primary-500)">
              {formatMoney(ourPriceMinor)}
            </text>
          </>
        ) : null}
        <path d={d} fill="none" stroke="var(--tone-2)" strokeWidth={2.2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.newPriceMinor)} r={4} fill="var(--surface)" stroke="var(--tone-2)" strokeWidth={2} />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[12px] text-muted tabular">
        <span>{formatDateKa(pts[0]!.createdAt)}</span>
        <span>{formatDateKa(pts.at(-1)!.createdAt)}</span>
      </figcaption>
    </figure>
  );
}
