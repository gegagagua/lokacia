'use client';
import * as React from 'react';
import { MONTHS_KA } from '@lokacia/contracts';

export const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS_KA[(m ?? 1) - 1]!.slice(0, 3)}`;
};

/** Minimal SVG bar chart (one series per day) with a visually hidden data table for screen readers. */
export function BarChart({ data, label, tone = 'primary', caption, dayLabel, valueLabel }: { data: { day: string; value: number }[]; label: string; tone?: 'primary' | 'link' | 'accent'; caption: string; dayLabel: string; valueLabel: string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 600;
  const H = 150;
  const padL = 28;
  const padB = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = max <= 5 ? max : Math.ceil(max / 5) * 5;
  const innerW = W - padL;
  const innerH = H - padB - 8;
  const bw = innerW / Math.max(1, data.length);
  const gap = data.length > 40 ? 0.5 : Math.min(3, bw * 0.25);
  const every = data.length <= 7 ? 1 : data.length <= 31 ? 7 : 15;
  const color = { primary: 'var(--primary)', link: 'var(--link)', accent: 'var(--accent)' }[tone];
  const total = data.reduce((a, d) => a + d.value, 0);
  const h = hover != null ? data[hover] : null;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-small">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular" aria-live="polite">
          {h ? `${shortDay(h.day)}: ${h.value}` : total}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}: ${total}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => {
          const y = 8 + innerH * (1 - f);
          return (
            <g key={f}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray={f === 0 ? undefined : '3 3'} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" className="tabular">
                {Math.round(niceMax * f)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bh = (d.value / niceMax) * innerH;
          const x = padL + i * bw + gap / 2;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * bw} y={8} width={bw} height={innerH} fill="transparent" />
              <rect x={x} y={8 + innerH - bh} width={Math.max(1, bw - gap)} height={Math.max(d.value ? 1.5 : 0, bh)} rx={Math.min(2, bw / 4)} fill={color} opacity={hover == null || hover === i ? 1 : 0.45} />
              {(i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every / 2 || i === data.length - 1) && (
                <text x={padL + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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
              <td>{shortDay(d.day)}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
