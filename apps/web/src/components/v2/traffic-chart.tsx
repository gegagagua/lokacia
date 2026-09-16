'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Footprints } from 'lucide-react';
import type { TrafficResponse } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { useFormat } from '@/i18n/use-format';

/** Monday-first order; weekday numbers follow JS (0 = Sunday). */
const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** V1: hourly foot-traffic bars for one weekday (gradient bars, segmented weekday tabs, table fallback, per-bar hover). */
export function TrafficChart({ traffic }: { traffic: TrafficResponse }) {
  const t = useTranslations('v2.traffic');
  const fmt = useFormat();
  const gid = React.useId().replace(/:/g, '');
  const [weekday, setWeekday] = React.useState<number>(() => new Date().getDay());
  const [hover, setHover] = React.useState<number | null>(null);
  const day = traffic.days.find((d) => d.weekday === weekday) ?? traffic.days[0];
  const max = Math.max(1, ...traffic.days.flatMap((d) => d.hours));
  const hours = day?.hours ?? [];
  const peakHour = hours.reduce((best, v, i) => (v > (hours[best] ?? 0) ? i : best), 0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(720);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 520 ? 220 : 280;
  const pad = { l: 40, r: 8, t: 18, b: 30 };
  const bw = (W - pad.l - pad.r) / 24;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + ORDER.length) % ORDER.length;
    setWeekday(ORDER[next]!);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('weekday')} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {ORDER.map((wd, i) => (
            <button
              key={wd}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={wd === weekday}
              tabIndex={wd === weekday ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => setWeekday(wd)}
              className={cn(
                'h-8 min-w-11 shrink-0 rounded-full px-3 text-small font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                wd === weekday ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
              )}
            >
              {t(`days.${wd}`)}
            </button>
          ))}
        </div>
        <span className="text-small text-muted">{traffic.source === 'samples' ? t('sourceSamples') : t('sourceProvider')}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
          <Footprints className="size-5 shrink-0 text-primary-soft-text" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <p className="text-small text-primary-soft-text">{t('dayTotal')}</p>
            <p className="text-[22px] font-bold leading-tight tracking-tight tabular">{fmt.number(day?.total ?? 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
          <Clock className="size-5 shrink-0 text-[#7a5200] dark:text-accent" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <p className="text-small text-[#6b4700] dark:text-accent">{t('peak')}</p>
            <p className="text-[22px] font-bold leading-tight tracking-tight tabular">
              {hh(peakHour)}{' '}
              <span className="text-small font-medium text-muted">
                · {fmt.number(hours[peakHour] ?? 0)} {t('perHour')}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div ref={boxRef} className="relative mt-4" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block overflow-visible" role="img" aria-label={t('chartLabel', { day: t(`days.${weekday}`) })}>
          <defs>
            <linearGradient id={`${gid}-bar`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-500)" />
              <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0.28" />
            </linearGradient>
            <linearGradient id={`${gid}-peak`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={v === 0 ? undefined : '4 5'} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)" className="tabular">
                {fmt.number(v)}
              </text>
            </g>
          ))}
          {hours.map((v, h) => {
            const x = pad.l + h * bw;
            const top = y(v);
            const height = Math.max(0, H - pad.b - top);
            const w = Math.min(bw * 0.68, 34);
            const x0 = x + (bw - w) / 2;
            const r = Math.min(5, height / 2, w / 2);
            const path = height > 0 ? `M${x0} ${H - pad.b} V${top + r} Q${x0} ${top} ${x0 + r} ${top} H${x0 + w - r} Q${x0 + w} ${top} ${x0 + w} ${top + r} V${H - pad.b} Z` : '';
            const active = hover === h;
            return (
              <g key={h} onMouseEnter={() => setHover(h)}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} rx={6} fill={active ? 'var(--surface-2)' : 'transparent'} />
                {path && <path d={path} fill={`url(#${gid}-${h === peakHour ? 'peak' : 'bar'})`} opacity={hover === null || active ? 1 : 0.5} style={{ transition: 'opacity 200ms' }} />}
                {h % 3 === 0 && (
                  <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--text-muted)" className="tabular">
                    {String(h).padStart(2, '0')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-text px-2.5 py-1.5 text-small font-medium tabular text-bg shadow-md"
            style={{ left: `${Math.min(90, Math.max(10, ((pad.l + (hover + 0.5) * bw) / W) * 100))}%`, top: `${(Math.max(pad.t, y(hours[hover] ?? 0)) / H) * 100}%` }}
            aria-hidden
          >
            {hh(hover)} · {fmt.number(hours[hover] ?? 0)} {t('people')}
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
              <td>{hh(h)}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
