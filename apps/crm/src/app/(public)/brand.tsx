import * as React from 'react';
import { cn } from '@lokacia/ui';

/** Org brand colour (validated hex) or null. */
export function validBrand(c: string | null | undefined): string | null {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : null;
}

/**
 * Hero background for public microsites: the org brand colour darkened toward near-black green so white text
 * keeps AA contrast whatever colour the agency picked; falls back to the lokacia `hero-gradient`.
 */
export function heroProps(brand: string | null): { className: string; style?: React.CSSProperties } {
  if (!brand) return { className: 'hero-gradient' };
  return {
    className: 'text-[#f3f8f6]',
    style: {
      background: `radial-gradient(900px 420px at 88% -12%, color-mix(in srgb, #e2aa1c 20%, transparent), transparent 60%), radial-gradient(800px 460px at 0% 120%, color-mix(in srgb, ${brand} 60%, transparent), transparent 60%), linear-gradient(135deg, color-mix(in srgb, ${brand} 42%, #06120e) 0%, color-mix(in srgb, ${brand} 62%, #06120e) 55%, color-mix(in srgb, ${brand} 72%, #06120e) 100%)`,
    },
  };
}

/** Org logo or a lettered gradient tile. */
export function OrgBrandMark({ name, logoUrl, brand, size = 40, className }: { name: string; logoUrl: string | null; brand: string | null; size?: number; className?: string }) {
  if (logoUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" width={size} height={size} className={cn('shrink-0 rounded-xl border border-border bg-surface object-contain', className)} style={{ width: size, height: size }} />;
  const c = brand ?? '#2e7a69';
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-xl font-bold text-white shadow-sm', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 60%, #06120e))` }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
