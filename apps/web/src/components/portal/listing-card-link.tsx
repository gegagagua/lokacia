'use client';
import Link from 'next/link';
import type { ListingCard as Card } from '@lokacia/contracts';
import { ListingCard } from '@lokacia/ui';
import { useFavorites } from './favorites';

/** ListingCard with Next.js links and an optimistic favorite heart (needs FavoritesProvider above). */
export function ListingCardLink({
  listing,
  typeNames,
  layout,
  priority,
  className,
  favorite = true,
}: {
  listing: Card;
  typeNames: Record<string, string>;
  layout?: 'grid' | 'row';
  priority?: boolean;
  className?: string;
  favorite?: boolean;
}) {
  const fav = useFavorites();
  return (
    <ListingCard
      listing={listing}
      href={`/listings/${listing.slug}`}
      LinkComponent={Link}
      businessTypeName={(s) => typeNames[s] ?? s}
      layout={layout}
      priority={priority}
      className={className}
      favorite={fav.isFavorite(listing.id)}
      onFavorite={favorite ? () => void fav.toggle(listing.id) : undefined}
    />
  );
}

/** Responsive grid of cards. */
export function ListingGrid({ listings, typeNames, priorityCount = 0, cols = 3 }: { listings: Card[]; typeNames: Record<string, string>; priorityCount?: number; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <ul className={`grid gap-4 ${grid}`}>
      {listings.map((l, i) => (
        <li key={l.id} className="flex">
          <ListingCardLink listing={l} typeNames={typeNames} priority={i < priorityCount} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
