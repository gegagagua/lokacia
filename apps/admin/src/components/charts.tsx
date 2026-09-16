'use client';
import * as React from 'react';
import { cn } from '@lokacia/ui';

type Point = { label: string; value: number };

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
};

/** Tooltip bubble positioned in % of the plot box. */
function Tip({ x, y, title, value }: { x: number; y: number; title: string; value: string }) {
  const alignRight = x > 70;
  const alignLeft = x < 30;
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-10 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2 text-small shadow-md',
        alignRight ? '-translate-x-full' : alignLeft ? '' : '-translate-x-1/2',
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="text-[12.5px] text-muted">{title}</div>
      <div className="font-bold tabular text-text">{value}</div>
    </div>
  );
}

/** Area chart: gradient fill, 2px line, recessive grid, crosshair + tooltip on hover/focus. Single series. */
export function AreaChart({ data, label, format = String, height = 220, className, xLabel }: { data: Point[]; label: string; format?: (v: number) => string; height?: number; className?: string; xLabel?: (p: Point) => string }) {
  const gid = React.useId().replace(/:/g, '');
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 600;
  const H = 200;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const n = data.length;
  const xs = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const ys = (v: number) => H - (v / max) * H;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.value).toFixed(1)}`).join(' ');
  const area = n ? `${line} L${xs(n - 1).toFixed(1)},${H} L${xs(0).toFixed(1)},${H} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))));
  };
  const h = hover !== null ? data[hover] : null;
  const last = data.at(-1);
  const xl = xLabel ?? ((p: Point) => p.label);
  return (
    <figure className={cn('w-full', className)}>
      <div className="flex gap-3">
        <div className="flex shrink-0 flex-col justify-between pb-6 text-right text-[12px] tabular text-muted" style={{ height }} aria-hidden>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {format(Math.round(t))}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="relative touch-none outline-none focus-visible:shadow-ring rounded-md"
            style={{ height: height - 24 }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            role="img"
            aria-label={`${label}: ${data.map((d) => `${xl(d)} ${format(d.value)}`).join(', ')}`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((x) => Math.min(n - 1, (x ?? -1) + 1));
              if (e.key === 'ArrowLeft') setHover((x) => Math.max(0, (x ?? n) - 1));
            }}
            onBlur={() => setHover(null)}
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-500)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <line key={t} x1="0" x2={W} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 5'} vectorEffect="non-scaling-stroke" />
              ))}
              {n > 0 && <path d={area} fill={`url(#a${gid})`} />}
              {n > 0 && <path d={line} fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              {h && hover !== null && <line x1={xs(hover)} x2={xs(hover)} y1="0" y2={H} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />}
            </svg>
            {last && hover === null && (
              <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500 ring-2 ring-surface" style={{ left: `${(xs(n - 1) / W) * 100}%`, top: `${(ys(last.value) / H) * 100}%` }} aria-hidden />
            )}
            {h && hover !== null && (
              <>
                <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500 ring-2 ring-surface shadow-sm" style={{ left: `${(xs(hover) / W) * 100}%`, top: `${(ys(h.value) / H) * 100}%` }} aria-hidden />
                <Tip x={(xs(hover) / W) * 100} y={(ys(h.value) / H) * 100} title={xl(h)} value={format(h.value)} />
              </>
            )}
          </div>
          <div className="mt-2 flex justify-between text-[12px] tabular text-muted" aria-hidden>
            <span>{data[0] ? xl(data[0]) : ''}</span>
            <span className="hidden sm:inline">{data[Math.floor(n / 2)] ? xl(data[Math.floor(n / 2)]!) : ''}</span>
            <span>{last ? xl(last) : ''}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Column chart with gradient bars, 4px rounded tops, hover tooltip; latest column emphasized. */
export function BarChart({ data, label, format = String, height = 240, className }: { data: Point[]; label: string; format?: (v: number) => string; height?: number; className?: string }) {
  const gid = React.useId().replace(/:/g, '');
  const [hover, setHover] = React.useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const n = data.length;
  const W = 100 * Math.max(1, n);
  const H = 200;
  const bw = 56;
  return (
    <figure className={cn('w-full', className)} aria-label={label}>
      <div className="flex gap-3">
        <div className="flex shrink-0 flex-col justify-between pb-7 text-right text-[12px] tabular text-muted" style={{ height }} aria-hidden>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="leading-none">
              {format(Math.round(t))}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: height - 28 }} onPointerLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
              <defs>
                <linearGradient id={`b${gid}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-500)" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0.35" />
                </linearGradient>
                <linearGradient id={`c${gid}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <line key={t} x1="0" x2={W} y1={H - (t / max) * H} y2={H - (t / max) * H} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 5'} vectorEffect="non-scaling-stroke" />
              ))}
              {data.map((d, i) => {
                const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * H);
                const x = i * 100 + (100 - bw) / 2;
                const isLast = i === n - 1;
                return <rect key={d.label} x={x} y={H - h} width={bw} height={h} rx="4" fill={`url(#${isLast ? 'c' : 'b'}${gid})`} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity" />;
              })}
            </svg>
            <div className="absolute inset-0 flex">
              {data.map((d, i) => (
                <button
                  key={d.label}
                  type="button"
                  className="h-full flex-1 rounded-md outline-none focus-visible:bg-surface-2/60"
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              ))}
            </div>
            {hover !== null && data[hover] && <Tip x={((hover + 0.5) / n) * 100} y={100 - (data[hover].value / max) * 100} title={data[hover].label} value={format(data[hover].value)} />}
          </div>
          <div className="mt-2 flex" aria-hidden>
            {data.map((d, i) => (
              <span key={d.label} className={cn('flex-1 truncate text-center text-[12px]', i === n - 1 ? 'font-semibold text-text' : 'text-muted')}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Compact sparkline with gradient area (decorative; pair with a visible number). */
export function Sparkline({ values, height = 44, label, className }: { values: number[]; height?: number; label: string; className?: string }) {
  const gid = React.useId().replace(/:/g, '');
  const w = 200;
  const H = 40;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`s${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-500)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && <polygon points={`0,${H} ${pts.join(' ')} ${w},${H}`} fill={`url(#s${gid})`} />}
      {values.length > 0 && <polyline points={pts.join(' ')} fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Kept for API compatibility: labelled columns. */
export function Bars({ data, format, label }: { data: Point[]; format?: (v: number) => string; label: string }) {
  return <BarChart data={data} format={format} label={label} />;
}

/** Ranked horizontal bars (label · value above a gradient track). */
export function HBars({ data, format, max: maxProp, className }: { data: Point[]; format?: (v: number) => string; max?: number; className?: string }) {
  const max = maxProp ?? Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className={cn('flex flex-col gap-3.5', className)}>
      {data.map((d) => (
        <li key={d.label} className="min-w-0" title={total ? `${Math.round((d.value / total) * 100)}%` : undefined}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[14.5px]">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 font-semibold tabular">{format ? format(d.value) : d.value}</span>
          </div>
          <span className="block h-2 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-gradient-to-r from-primary-500/60 to-primary-500" style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
