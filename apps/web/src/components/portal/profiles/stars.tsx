import { Star } from 'lucide-react';

/** Read-only star rating (0–5). */
export function Stars({ value, size = 'size-4', label }: { value: number; size?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${value >= n - 0.25 ? 'fill-accent text-accent' : 'text-border-strong'}`} strokeWidth={1.5} aria-hidden />
      ))}
    </span>
  );
}
