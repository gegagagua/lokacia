'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { TrafficResponse } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';

/** Monday-first order; weekday numbers follow JS (0 = Sunday). */
const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** V1: hourly foot-traffic bars for one weekday (single series, table fallback, per-bar hover). */
export function TrafficChart({ traffic }: { traffic: TrafficResponse }) {
  const t = useTranslations('v2.traffic');
  const fmt = useFormat();
  const [weekday, setWeekday] = React.useState<number>(() => new Date().getDay());
  const [hover, setHover] = React.useState<number | null>(null);
  const day = traffic.days.find((d) => d.weekday === weekday) ?? traffic.days[0];
  const max = Math.max(1, ...traffic.days.flatMap((d) => d.hours));
  const hours = day?.hours ?? [];
  const peakHour = hours.reduce((best, v, i) => (v > (hours[best] ?? 0) ? i : best), 0);
  const W = 720;
  const H = 220;
  const pad = { l: 40, r: 8, t: 16, b: 28 };
  const bw = (W - pad.l - pad.r) / 24;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];

  return (
    <div>
      <div role="tablist" aria-label={t('weekday')} className="flex gap-1 overflow-x-auto pb-1">
        {ORDER.map((wd) => (
          <button
            key={wd}
            role="tab"
            type="button"
            aria-selected={wd === weekday}
            onClick={() => setWeekday(wd)}
            className={cn('h-8 shrink-0 rounded-button border px-3 text-small transition-colors', wd === weekday ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface text-muted hover:text-text')}
          >
            {t(`days.${wd}`)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-small">
        <span>
          {t('dayTotal')}: <b className="tabular">{fmt.number(day?.total ?? 0)}</b>
        </span>
        <span>
          {t('peak')}: <b className="tabular">{String(peakHour).padStart(2, '0')}:00</b> ({fmt.number(hours[peakHour] ?? 0)} {t('perHour')})
        </span>
        <span className="text-muted">{traffic.source === 'samples' ? t('sourceSamples') : t('sourceProvider')}</span>
      </div>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t('chartLabel', { day: t(`days.${weekday}`) })}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)" className="tabular">
                {fmt.number(v)}
              </text>
            </g>
          ))}
          {hours.map((v, h) => {
            const x = pad.l + h * bw;
            const top = y(v);
            const height = Math.max(0, H - pad.b - top);
            const r = Math.min(4, height / 2, (bw - 2) / 2);
            const w = bw - 2;
            const path = height > 0 ? `M${x + 1} ${H - pad.b} V${top + r} Q${x + 1} ${top} ${x + 1 + r} ${top} H${x + 1 + w - r} Q${x + 1 + w} ${top} ${x + 1 + w} ${top + r} V${H - pad.b} Z` : '';
            return (
              <g key={h} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                {path && <path d={path} fill={h === peakHour ? 'var(--accent)' : 'var(--primary)'} opacity={hover === null || hover === h ? 1 : 0.55} />}
                {h % 3 === 0 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)" className="tabular">
                    {String(h).padStart(2, '0')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 rounded-[6px] border border-border bg-surface px-2 py-1 text-small tabular" style={{ left: `${Math.min(80, ((pad.l + hover * bw) / W) * 100)}%` }} aria-hidden>
            {String(hover).padStart(2, '0')}:00 — {fmt.number(hours[hover] ?? 0)} {t('people')}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{t('chartLabel', { day: t(`days.${weekday}`) })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('hour')}</th>
            <th scope="col">{t('people')}</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((v, h) => (
            <tr key={h}>
              <td>{String(h).padStart(2, '0')}:00</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
