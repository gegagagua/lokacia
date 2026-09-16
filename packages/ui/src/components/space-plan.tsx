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
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className={cn('block h-auto w-full text-text', className)} role="img" aria-label={label}>
      <title>{label}</title>
      {/* grid */}
      <g opacity=".35">
        {Array.from({ length: Math.floor(VW / 16) }, (_, i) => (
          <line key={`v${i}`} x1={i * 16} y1={0} x2={i * 16} y2={VH} stroke="var(--border)" strokeWidth=".6" />
        ))}
        {Array.from({ length: Math.floor(VH / 16) }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 16} x2={VW} y2={i * 16} stroke="var(--border)" strokeWidth=".6" />
        ))}
      </g>
      <path d={path} fill="var(--surface)" stroke="currentColor" strokeWidth={compact ? 2.5 : 3} strokeLinejoin="miter" />
      {/* width dimension */}
      <g stroke="var(--link)" strokeWidth="1" fill="var(--link)">
        <line x1={ox} y1={oy - 14} x2={ox + pw} y2={oy - 14} />
        <line x1={ox} y1={oy - 14 - tick} x2={ox} y2={oy - 14 + tick} />
        <line x1={ox + pw} y1={oy - 14 - tick} x2={ox + pw} y2={oy - 14 + tick} />
        <text x={ox + pw / 2} y={oy - 20} textAnchor="middle" fontSize="11" stroke="none" className="tabular">
          {formatNumber(w, 1)} {U.m}
        </text>
        {/* depth dimension */}
        <line x1={ox - 14} y1={oy} x2={ox - 14} y2={oy + pd} />
        <line x1={ox - 14 - tick} y1={oy} x2={ox - 14 + tick} y2={oy} />
        <line x1={ox - 14 - tick} y1={oy + pd} x2={ox - 14 + tick} y2={oy + pd} />
        <text x={ox - 20} y={oy + pd / 2} textAnchor="middle" fontSize="11" stroke="none" transform={`rotate(-90 ${ox - 20} ${oy + pd / 2})`}>
          {formatNumber(d, 1)} {U.m}
        </text>
      </g>
      <text x={ox + pw / 2} y={oy + pd / 2 + 7} textAnchor="middle" fontSize={compact ? 20 : 24} fontWeight="600" fill="currentColor" style={{ fontStretch: '75%' }}>
        {formatNumber(areaM2)} {U.m2}
      </text>
      {/* entrance marker */}
      <line x1={ox + pw * 0.2} y1={oy + pd} x2={ox + pw * 0.2 + Math.min(28, pw * 0.25)} y2={oy + pd} stroke="var(--surface)" strokeWidth={4} />
      <path d={`M${ox + pw * 0.2} ${oy + pd} a${Math.min(28, pw * 0.25)} ${Math.min(28, pw * 0.25)} 0 0 0 ${Math.min(28, pw * 0.25)} ${-Math.min(28, pw * 0.25)}`} fill="none" stroke="var(--border-strong)" strokeWidth="1" />
      <circle cx={ox + pw - 10} cy={oy + 10} r={4} fill="var(--c-sulfur)" />
      {!compact && (ceilingM || powerKw) && (
        <g fontSize="11" fill="var(--text-muted)">
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
