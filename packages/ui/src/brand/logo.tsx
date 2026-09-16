import * as React from 'react';
import { cn } from '../lib/cn';

/** Mark: a location pin set into the corner of a floor plan — two lines and one dot (BRAND.md). */
export function LogoMark({ size = 28, className, title = 'lokacia.ge' }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={Math.max(20, size)} height={Math.max(20, size)} viewBox="0 0 32 32" fill="none" role="img" aria-label={title} className={className}>
      <path d="M5 27V9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      <path d="M5 27H23" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      <circle cx="21" cy="11" r="4.2" fill="var(--c-sulfur)" />
    </svg>
  );
}

export function LogoWordmark({ className, showGeorgian = true }: { className?: string; showGeorgian?: boolean }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 leading-none', className)}>
      <span className="compact text-[22px] font-semibold tracking-tight">lokacia</span>
      {showGeorgian && <span className="compact text-[15px] text-muted">ლოკაცია</span>}
    </span>
  );
}

/** Lockup with clear space = half the mark height. */
export function Logo({ className, size = 28, showGeorgian = true }: { className?: string; size?: number; showGeorgian?: boolean }) {
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size / 3 }}>
      <LogoMark size={size} className="text-primary" />
      <LogoWordmark showGeorgian={showGeorgian} />
    </span>
  );
}

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#EDF0EB"/><path d="M5 27V9" stroke="#1E4A42" stroke-width="2.6" stroke-linecap="square"/><path d="M5 27H23" stroke="#1E4A42" stroke-width="2.6" stroke-linecap="square"/><circle cx="21" cy="11" r="4.2" fill="#D8A31A"/></svg>`;
