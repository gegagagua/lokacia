import * as React from 'react';
import { formatNumberFor, type AppLocale } from '@lokacia/contracts';
import { cn } from '../lib/cn';

export type SpacePlanProps = {
  widthM?: number | null;
  depthM?: number | null;
  areaM2: number;
  ceilingM?: number | null;
  powerKw?: number | null;
  outline?: [number, number][] | null;
  compact?: boolean;
  className?: string;
  title?: string;
  locale?: AppLocale;
};

const PLAN_LABELS: Record<AppLocale, { plan: string; m: string; m2: string; ceiling: string; kw: string }> = {
  ka: { plan: 'ნახაზი', m: 'მ', m2: 'მ²', ceiling: 'ჭერი', kw: 'კვტ' },
  en: { plan: 'Floor plan', m: 'm', m2: 'm²', ceiling: 'ceiling', kw: 'kW' },
  ru: { plan: 'Планировка', m: 'м', m2: 'м²', ceiling: 'потолок', kw: 'кВт' },
};

/**
 * Signature component (BRAND.md): the space outline drawn like a floor plan with dimension lines
 * (width × depth), area in the middle, ceiling height and power as annotations.
 */
export function SpacePlan({ widthM, depthM, areaM2, ceilingM, powerKw, outline, compact, className, title, locale = 'ka' }: SpacePlanProps) {
  const U = PLAN_LABELS[locale] ?? PLAN_LABELS.ka;
  const formatNumber = (v: number, digits = 0) => formatNumberFor(v, locale, digits);
  const w = widthM && widthM > 0 ? widthM : Math.sqrt(areaM2 * 1.4);
  const d = depthM && depthM > 0 ? depthM : areaM2 / w;
  const VW = 320;
  const VH = compact ? 180 : 220;
  const pad = { l: 44, r: 28, t: 34, b: compact ? 26 : 44 };
  const scale = Math.min((VW - pad.l - pad.r) / w, (VH - pad.t - pad.b) / d);
  const pw = w * scale;
  const pd = d * scale;
  const ox = pad.l + (VW - pad.l - pad.r - pw) / 2;
  const oy = pad.t + (VH - pad.t - pad.b - pd) / 2;
  const pts = outline && outline.length >= 3 ? outline.map(([x, y]) => [ox + (x / w) * pw, oy + (y / d) * pd]) : [[ox, oy], [ox + pw, oy], [ox + pw, oy + pd], [ox, oy + pd]];
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`).join(' ') + ' Z';
  const tick = 5;
  const label = title ?? `${U.plan}: ${formatNumber(w, 1)} × ${formatNumber(d, 1)} ${U.m}, ${formatNumber(areaM2)} ${U.m2}`;
  const dim = 'var(--link)';
  const fid = React.useId().replace(/:/g, '');
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className={cn('block h-auto w-full text-text', className)} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <linearGradient id={`sp-fill-${fid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--primary-500) 16%, var(--surface))" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--primary-500) 6%, var(--surface))" />
        </linearGradient>
        <pattern id={`sp-dots-${fid}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".9" fill="var(--border-strong)" opacity=".55" />
        </pattern>
      </defs>
      {/* soft dotted grid */}
      <rect x="0" y="0" width={VW} height={VH} fill={`url(#sp-dots-${fid})`} opacity=".7" />
      <path d={path} fill={`url(#sp-fill-${fid})`} stroke="var(--primary-500)" strokeWidth={compact ? 2.5 : 3} strokeLinejoin="round" />
      {/* width dimension */}
      <g stroke={dim} strokeWidth="1.25" strokeLinecap="round" fill={dim}>
        <line x1={ox} y1={oy - 14} x2={ox + pw} y2={oy - 14} opacity=".7" />
        <line x1={ox} y1={oy - 14 - tick} x2={ox} y2={oy - 14 + tick} />
        <line x1={ox + pw} y1={oy - 14 - tick} x2={ox + pw} y2={oy - 14 + tick} />
        <text x={ox + pw / 2} y={oy - 20} textAnchor="middle" fontSize="11" fontWeight="600" stroke="none" className="tabular">
          {formatNumber(w, 1)} {U.m}
        </text>
        {/* depth dimension */}
        <line x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + pd} opacity=".7" />
        <line x1={ox - 14 - tick} y1={oy} x2={ox - 14 + tick} y2={oy} />
        <line x1={ox - 14 - tick} y1={oy + pd} x2={ox - 14 + tick} y2={oy + pd} />
        <text x={ox - 20} y={oy + pd / 2} textAnchor="middle" fontSize="11" fontWeight="600" stroke="none" transform={`rotate(-90 ${ox - 20} ${oy + pd / 2})`}>
          {formatNumber(d, 1)} {U.m}
        </text>
      </g>
      <text x={ox + pw / 2} y={oy + pd / 2 + 8} textAnchor="middle" fontSize={compact ? 21 : 26} fontWeight="700" letterSpacing="-0.02em" fill="currentColor" className="tabular">
        {formatNumber(areaM2)} {U.m2}
      </text>
      {/* entrance marker */}
      <line x1={ox + pw * 0.2} y1={oy + pd} x2={ox + pw * 0.2 + Math.min(28, pw * 0.25)} y2={oy + pd} stroke="var(--surface)" strokeWidth={4} />
      <path d={`M${ox + pw * 0.2} ${oy + pd} a${Math.min(28, pw * 0.25)} ${Math.min(28, pw * 0.25)} 0 0 0 ${Math.min(28, pw * 0.25)} ${-Math.min(28, pw * 0.25)}`} fill="none" stroke="var(--primary-500)" strokeWidth="1" strokeDasharray="2 2" opacity=".7" />
      <circle cx={ox + pw - 10} cy={oy + 10} r={6} fill="var(--accent)" opacity=".25" />
      <circle cx={ox + pw - 10} cy={oy + 10} r={3.5} fill="var(--accent)" />
      {!compact && (ceilingM || powerKw) && (
        <g fontSize="11.5" fontWeight="500" fill="var(--text-muted)">
          {ceilingM ? <text x={pad.l} y={VH - 14}>↕ {U.ceiling} {formatNumber(ceilingM, 1)} {U.m}</text> : null}
          {powerKw ? (
            <text x={VW - pad.r} y={VH - 14} textAnchor="end">
              ⚡ {formatNumber(powerKw)} {U.kw}
            </text>
          ) : null}
        </g>
      )}
    </svg>
  );
}
