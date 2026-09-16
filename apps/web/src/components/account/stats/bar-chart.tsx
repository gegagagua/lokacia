'use client';
import * as React from 'react';
import { MONTHS_KA, type AppLocale } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';

const dayFmt = { en: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }), ru: new Intl.DateTimeFormat('ru-RU', { month: 'short', day: 'numeric' }) } as const;
export const shortDay = (day: string, locale: AppLocale = 'ka') => {
  const [y, m, d] = day.split('-').map(Number);
  if (locale !== 'ka') return dayFmt[locale].format(new Date(y!, (m ?? 1) - 1, d));
  return `${d} ${MONTHS_KA[(m ?? 1) - 1]!.slice(0, 3)}`;
};

type Tone = 'primary' | 'link' | 'accent';
const COLORS: Record<Tone, string> = { primary: 'var(--primary-500)', link: 'var(--link)', accent: 'var(--accent)' };

/** Daily series chart: gradient area (or bars for short periods), hover/focus tooltip, visually hidden data table for screen readers. */
export function BarChart({ data, label, tone = 'primary', caption, dayLabel, valueLabel, height = 170, width = 640, variant }: { data: { day: string; value: number }[]; label: string; tone?: Tone; caption: string; dayLabel: string; valueLabel: string; height?: number; width?: number; variant?: 'area' | 'bars' }) {
  const { locale } = useFormat();
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, '');
  const kind = variant ?? (data.length <= 10 ? 'bars' : 'area');
  const W = width;
  const H = height;
  const padL = 34;
  const padB = 24;
  const padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const innerW = W - padL - 6;
  const innerH = H - padB - padT;
  const n = Math.max(1, data.length);
  const step = kind === 'bars' ? innerW / n : innerW / Math.max(1, n - 1);
  const xAt = (i: number) => padL + (kind === 'bars' ? i * step + step / 2 : i * step);
  const yAt = (v: number) => padT + innerH * (1 - v / niceMax);
  const every = data.length <= 10 ? 1 : data.length <= 31 ? 7 : 15;
  const color = COLORS[tone];
  const total = data.reduce((a, d) => a + d.value, 0);
  const h = hover != null ? data[hover] : null;

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(d.value).toFixed(1)}`).join(' ');
  const area = data.length ? `${line} L${xAt(data.length - 1).toFixed(1)},${padT + innerH} L${xAt(0).toFixed(1)},${padT + innerH} Z` : '';

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = kind === 'bars' ? Math.floor((x - padL) / step) : Math.round((x - padL) / step);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {label}
        </span>
        <span className="text-[20px] font-bold tabular" aria-live="polite">
          {h ? (
            <>
              <span className="mr-1.5 text-small font-medium text-muted">{shortDay(h.day, locale)}</span>
              {h.value}
            </>
          ) : (
            total
          )}
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none overflow-visible" role="img" aria-label={`${label}: ${total}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((f) => {
            const y = padT + innerH * (1 - f);
            return (
              <g key={f}>
                <line x1={padL} x2={W - 6} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 0 ? undefined : '4 4'} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tabular">
                  {Math.round(niceMax * f)}
                </text>
              </g>
            );
          })}
          {kind === 'area' ? (
            <>
              <path d={area} fill={`url(#g-${id})`} />
              <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            data.map((d, i) => {
              const bw = Math.min(36, step * 0.62);
              const bh = (d.value / niceMax) * innerH;
              return <rect key={d.day} x={xAt(i) - bw / 2} y={padT + innerH - bh} width={bw} height={Math.max(d.value ? 2 : 0, bh)} rx={Math.min(8, bw / 3)} fill={color} opacity={hover == null || hover === i ? 1 : 0.4} />;
            })
          )}
          {data.map((d, i) =>
            (i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every / 2 || i === data.length - 1) ? (
              <text key={d.day} x={xAt(i)} y={H - 6} textAnchor={kind === 'area' && i === 0 ? 'start' : kind === 'area' && i === data.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--text-muted)">
                {shortDay(d.day, locale)}
              </text>
            ) : null,
          )}
          {h && hover != null && (
            <g pointerEvents="none">
              <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + innerH} stroke="var(--border-strong)" strokeDasharray="3 3" />
              {kind === 'area' && <circle cx={xAt(hover)} cy={yAt(h.value)} r={5} fill="var(--surface)" stroke={color} strokeWidth={2.5} />}
            </g>
          )}
        </svg>
        {h && hover != null && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-xl border border-border bg-surface px-2.5 py-1.5 text-[12.5px] shadow-md" style={{ left: `${(xAt(hover) / W) * 100}%` }} aria-hidden>
            <span className="text-muted">{shortDay(h.day, locale)}</span> <span className="font-bold tabular">{h.value}</span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{dayLabel}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{shortDay(d.day, locale)}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
