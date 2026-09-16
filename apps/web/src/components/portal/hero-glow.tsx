import * as React from 'react';

/**
 * Decorative glows + dotted texture, token colours only.
 * `band` — header bands with a bottom border; `page` — full-page backdrops (no bottom glow, fades into the page background).
 */
export function HeroGlow({ variant = 'band' }: { variant?: 'band' | 'page' }) {
  const background =
    variant === 'band'
      ? 'radial-gradient(700px 320px at 92% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), radial-gradient(640px 360px at -5% 120%, color-mix(in srgb, var(--primary-500) 16%, transparent), transparent 70%), linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)'
      : 'radial-gradient(760px 380px at 90% -5%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%), radial-gradient(640px 420px at 0% 0%, color-mix(in srgb, var(--primary-500) 10%, transparent), transparent 70%), linear-gradient(180deg, var(--surface) 0%, var(--bg) 70%)';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0" style={{ background }} />
      <div
        className="absolute inset-0 opacity-60 [mask-image:linear-gradient(180deg,black,transparent_85%)]"
        style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--border-strong) 60%, transparent) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
    </div>
  );
}
