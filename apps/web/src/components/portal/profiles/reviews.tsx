import { getTranslations } from 'next-intl/server';
import { formatDateKa, type ReviewDto } from '@lokacia/contracts';
import { Stars } from './stars';

export async function ReviewsList({ reviews }: { reviews: ReviewDto[] }) {
  const t = await getTranslations('profiles');
  if (!reviews.length) return <p className="text-muted">{t('noReviews')}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
      {reviews.map((r) => (
        <li key={r.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{r.authorName}</span>
            <Stars value={r.rating} label={t('review.stars', { n: r.rating })} size="size-3.5" />
          </div>
          {r.body && <p className="mt-1.5">{r.body}</p>}
          <p className="mt-1 text-small text-muted tabular">{formatDateKa(r.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
