import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the BRAND.md type-scale utilities (theme.css `--text-*`), otherwise it treats
 * e.g. `text-small` as a text *color* and drops `text-primary-contrast` when both are present.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['display', 'h1', 'h2', 'h3', 'body', 'small'] },
    classGroups: { 'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'small'] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
