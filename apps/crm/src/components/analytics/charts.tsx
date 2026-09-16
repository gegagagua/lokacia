'use client';
import * as React from 'react';
import { cn } from '@lokacia/ui';
import { toneClass, type Tone } from '@/components/common/ui';

/**
 * CRM v2 charts: soft gradients, rounded marks, dashed gridlines, native tooltips (title).
 * Every chart also exposes its data as a visually hidden table for screen readers.
 */
export type BarTone = 'primary' | 'success' | 'danger' | 'muted' | Tone;
export type BarDatum = { key: string; label: string; value: number; display: string; tone?: BarTone; hint?: string };

const toTone = (t: BarTone | undefined): Tone => (t === 'muted' ? 'neutral' : (t ?? 'primary'));

function SrTable({ caption, data, valueHeader }: { caption: string; data: BarDatum[]; valueHeader?: string }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>
                {valueHeader ? `${valueHeader}: ` : ''}
                {d.display}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bars: label + value on top, rounded gradient bar on a soft track. */
export function HBarChart({ data, caption, valueHeader, className }: { data: BarDatum[]; caption: string; valueHeader: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className={cn('flex flex-col', className)}>
      <div aria-hidden className="flex flex-col gap-3.5">
        {data.map((d) => {
          const w = d.value > 0 ? Math.max(2.5, (d.value / max) * 100) : 0;
          return (
            <div key={d.key} className={cn('group', toneClass(toTone(d.tone)))} title={`${d.label}: ${d.display}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-tone" />
                  <span className="truncate font-medium">{d.label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular">{d.display}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-3/70">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:brightness-110"
                  style={{ width: `${w}%`, background: 'linear-gradient(90deg, color-mix(in srgb, var(--tone) 55%, transparent), var(--tone))' }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <SrTable caption={caption} data={data} valueHeader={valueHeader} />
    </figure>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

/** Vertical columns with gradient fill, rounded tops, dashed gridlines and value labels. */
export function ColumnChart({ data, caption, height = 200, className, tone = 'primary' }: { data: BarDatum[]; caption: string; height?: number; className?: string; tone?: Tone }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const best = Math.max(...data.map((d) => d.value));
  return (
    <figure className={cn('w-full', className)}>
      <div aria-hidden className="relative" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className={cn('absolute inset-x-0 border-t', g === 0 ? 'border-border-strong' : 'border-dashed border-border')} style={{ bottom: `${g * 100}%` }} />
        ))}
        <div className="absolute inset-0 grid items-end gap-[6%] px-[2%]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {data.map((d) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * 100) : 0;
            const top = d.value === best && best > 0;
            return (
              <div key={d.key} className={cn('group relative flex h-full flex-col items-center justify-end', toneClass(d.tone ? toTone(d.tone) : tone))} title={`${d.label}: ${d.display}`}>
                <span className={cn('mb-1 whitespace-nowrap text-[11.5px] font-semibold tabular transition-colors', top ? 'text-text' : 'text-muted group-hover:text-text')} style={{ visibility: d.value > 0 ? 'visible' : 'hidden' }}>
                  {d.display}
                </span>
                <div
                  className="w-full max-w-14 rounded-t-[10px] transition-all duration-500 ease-out group-hover:brightness-110"
                  style={{ height: `calc(${h}% - 20px)`, minHeight: d.value > 0 ? 4 : 0, background: top ? 'linear-gradient(180deg, var(--tone), color-mix(in srgb, var(--tone) 55%, transparent))' : 'linear-gradient(180deg, color-mix(in srgb, var(--tone) 70%, transparent), color-mix(in srgb, var(--tone) 25%, transparent))' }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="mt-2 grid gap-[6%] px-[2%] text-center text-[12px] text-muted tabular" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <span key={d.key} className="truncate">
            {d.label}
          </span>
        ))}
      </div>
      <SrTable caption={caption} data={data} />
    </figure>
  );
}

/** Smooth area chart (SVG) with gradient fill and HTML point markers (no distortion). */
export function AreaChart({ data, caption, height = 200, className, tone = 'primary' }: { data: BarDatum[]; caption: string; height?: number; className?: string; tone?: Tone }) {
  const gid = React.useId().replace(/:/g, '');
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const n = data.length;
  const W = 100;
  const H = 100;
  const pts = data.map((d, i) => ({ x: n <= 1 ? W / 2 : 4 + (i * (W - 8)) / (n - 1), y: H - (d.value / max) * (H - 14), d }));
  const path = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1]!;
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');
  const area = pts.length ? `${path} L ${pts[pts.length - 1]!.x} ${H} L ${pts[0]!.x} ${H} Z` : '';
  return (
    <figure className={cn('w-full', toneClass(tone), className)}>
      <div aria-hidden className="relative" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className={cn('absolute inset-x-0 border-t', g === 0 ? 'border-border-strong' : 'border-dashed border-border')} style={{ bottom: `${g * 86}%` }} />
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--tone)', stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: 'var(--tone)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#a${gid})`} />}
          {path && <path d={path} fill="none" style={{ stroke: 'var(--tone)' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.map((p) => (
          <div key={p.d.key} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }} title={`${p.d.label}: ${p.d.display}`}>
            <span className="block size-3 rounded-full border-2 border-tone bg-surface shadow-sm transition-transform group-hover:scale-125" />
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface px-1.5 py-0.5 text-[11.5px] font-semibold tabular shadow-sm ring-1 ring-border">{p.d.display}</span>
          </div>
        ))}
      </div>
      <div aria-hidden className="relative mt-2 h-5 text-[12px] text-muted tabular">
        {pts.map((p) => (
          <span key={p.d.key} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${p.x}%` }}>
            {p.d.label}
          </span>
        ))}
      </div>
      <SrTable caption={caption} data={data} />
    </figure>
  );
}

/** Single stacked bar (pipeline distribution) with legend chips. */
export function StackedBar({ data, caption, className, legend = true }: { data: BarDatum[]; caption: string; className?: string; legend?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className={cn('flex flex-col gap-4', className)}>
      <div aria-hidden className="flex h-4 w-full gap-1 overflow-hidden rounded-full bg-surface-3/70">
        {total > 0 &&
          data
            .filter((d) => d.value > 0)
            .map((d) => (
              <div key={d.key} className={cn('h-full rounded-full transition-all duration-700 first:rounded-l-full last:rounded-r-full hover:brightness-110', toneClass(toTone(d.tone)))} style={{ width: `${(d.value / total) * 100}%`, background: 'linear-gradient(180deg, color-mix(in srgb, var(--tone) 80%, #fff), var(--tone))' }} title={`${d.label}: ${d.display}`} />
            ))}
      </div>
      {legend && (
        <ul aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
          {data.map((d) => (
            <li key={d.key} className={cn('min-w-0', toneClass(toTone(d.tone)))}>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <span className="size-2.5 shrink-0 rounded-[4px] bg-tone" />
                <span className="truncate">{d.label}</span>
              </div>
              <div className="mt-0.5 pl-[18px] text-[18px] font-bold leading-6 tabular">{d.display}</div>
              {d.hint && <div className="truncate pl-[18px] text-[12.5px] text-muted tabular">{d.hint}</div>}
            </li>
          ))}
        </ul>
      )}
      <SrTable caption={caption} data={data.map((d) => ({ ...d, display: d.hint ? `${d.display} · ${d.hint}` : d.display }))} />
    </figure>
  );
}

/** Circular progress ring (e.g. win rate). */
export function Ring({ value, size = 96, stroke = 10, tone = 'primary', label, children }: { value: number; size?: number; stroke?: number; tone?: Tone; label: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="img" aria-label={label} className={cn('relative grid shrink-0 place-items-center', toneClass(tone))} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--surface-3)' }} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--tone)' }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
