import { MONTHS_KA } from '@lokacia/contracts';

/** "2026-08-19" → "19 აგვ" */
export function shortDay(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-');
  const name = MONTHS_KA[Number(m) - 1];
  return name ? `${Number(d)} ${name.slice(0, 3)}` : iso;
}

/** "2026-08" → "აგვ 26" */
export function shortMonth(ym: string) {
  const [y, m] = ym.split('-');
  const name = MONTHS_KA[Number(m) - 1];
  return name ? `${name.slice(0, 3)} ${y?.slice(2) ?? ''}` : ym;
}

/** Stable pseudo-random hue index for a string (avatars/placeholders). */
export function hashIndex(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}
