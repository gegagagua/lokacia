import { formatMoney, formatDateKa, type CompetitorPriceChange } from '@lokacia/contracts';

/** Step chart of competitor price changes (oldest → newest), drawing style. */
export function PriceHistoryChart({ changes, ourPriceMinor, label }: { changes: CompetitorPriceChange[]; ourPriceMinor: number | null; label: string }) {
  const pts = [...changes].reverse();
  if (!pts.length) return null;
  const W = 320;
  const H = 120;
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
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ourPriceMinor ? (
          <>
            <line x1={0} x2={W} y1={y(ourPriceMinor)} y2={y(ourPriceMinor)} stroke="var(--primary)" strokeDasharray="4 3" strokeWidth={1} />
            <text x={W - 4} y={y(ourPriceMinor) - 4} textAnchor="end" fontSize={10} fill="var(--primary)">
              {formatMoney(ourPriceMinor)}
            </text>
          </>
        ) : null}
        <path d={d} fill="none" stroke="var(--link)" strokeWidth={1.5} />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.newPriceMinor)} r={3} fill="var(--surface)" stroke="var(--link)" strokeWidth={1.5} />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted tabular">
        <span>{formatDateKa(pts[0]!.createdAt)}</span>
        <span>{formatDateKa(pts.at(-1)!.createdAt)}</span>
      </figcaption>
    </figure>
  );
}
