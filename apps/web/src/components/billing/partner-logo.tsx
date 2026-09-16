import { cn } from '@lokacia/ui';

const PALETTES = [
  'from-[#1e4a42] to-[#2e7a69] text-white',
  'from-[#2a58ad] to-[#5b86d6] text-white',
  'from-[#c9921a] to-[#f0bd3a] text-[#17201d]',
  'from-[#8c3a2a] to-[#c05a42] text-white',
  'from-[#3d3f8f] to-[#6b6fd1] text-white',
];

/** Partner logo placeholder: gradient monogram tile derived from the partner name (stable per name). */
export function PartnerLogo({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  const words = name.replace(/[„“"«»]/g, '').split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words.slice(-2) : words).map((w) => [...w][0] ?? '').join('').toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center bg-gradient-to-br font-bold shadow-xs ring-1 ring-black/5', size === 'sm' ? 'size-9 rounded-xl text-[13px]' : 'size-12 rounded-2xl text-[16px]', PALETTES[h % PALETTES.length], className)}>
      {letters}
    </span>
  );
}
