'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ListingCard } from '@lokacia/contracts';
import { IconButton, cn } from '@lokacia/ui';
import { ListingCardLink } from '../listing-card-link';

/** Horizontal snap carousel of listing cards with prev/next controls and fade edges. */
export function SimilarCarousel({ listings, typeNames, labelledBy }: { listings: ListingCard[]; typeNames: Record<string, string>; labelledBy: string }) {
  const t = useTranslations('listing.gallery');
  const ref = React.useRef<HTMLUListElement>(null);
  const [edge, setEdge] = React.useState({ start: true, end: false });
  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);
  React.useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);
  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(300, el.clientWidth * 0.8), behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div className="absolute -top-16 right-0 hidden gap-2 md:flex">
        <IconButton label={t('prev')} variant="secondary" className="rounded-full" onClick={() => scroll(-1)} disabled={edge.start}>
          <ChevronLeft className="size-5" strokeWidth={2} />
        </IconButton>
        <IconButton label={t('next')} variant="secondary" className="rounded-full" onClick={() => scroll(1)} disabled={edge.end}>
          <ChevronRight className="size-5" strokeWidth={2} />
        </IconButton>
      </div>
      <ul
        ref={ref}
        onScroll={update}
        aria-labelledby={labelledBy}
        className="-mx-4 flex w-[calc(100%+32px)] max-w-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 pt-1 [scrollbar-width:none] md:mx-0 md:w-full md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {listings.map((l) => (
          <li key={l.id} className="flex w-[82%] shrink-0 snap-start sm:w-[calc((100%-16px)/2)] lg:w-[calc((100%-32px)/3)]">
            <ListingCardLink listing={l} typeNames={typeNames} className="w-full" />
          </li>
        ))}
      </ul>
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-bg to-transparent transition-opacity md:block', edge.end && 'opacity-0')} />
    </div>
  );
}
