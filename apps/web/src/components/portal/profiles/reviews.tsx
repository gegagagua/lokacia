import { getTranslations } from 'next-intl/server';
import type { ReviewDto } from '@lokacia/contracts';
import { MessageSquareQuote } from 'lucide-react';
import { Avatar, EmptyState } from '@lokacia/ui';
import { getFormat } from '@/i18n/server';
import { Stars } from './stars';

export async function ReviewsList({ reviews }: { reviews: ReviewDto[] }) {
  const t = await getTranslations('profiles');
  const f = await getFormat();
  if (!reviews.length) return <EmptyState icon={<MessageSquareQuote className="size-6" strokeWidth={2} aria-hidden />} title={t('noReviews')} className="py-10" />;
  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((r) => (
        <li key={r.id} className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar name={r.authorName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.authorName}</p>
              <p className="text-small text-muted tabular">{f.date(r.createdAt)}</p>
            </div>
            <Stars value={r.rating} label={t('review.stars', { n: r.rating })} size="size-4" />
          </div>
          {r.body && <p className="mt-3 leading-relaxed">{r.body}</p>}
        </li>
      ))}
    </ul>
  );
}
