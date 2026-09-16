import { Skeleton } from '@lokacia/ui';
import { CardSkeletons } from '@/components/portal/search/search-view';

export default function SearchLoading() {
  return (
    <div className="container-page py-6" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-32" />
      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0" />
        ))}
      </div>
      <div className="mt-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
        <Skeleton className="hidden h-[520px] lg:block" />
        <CardSkeletons count={6} />
      </div>
    </div>
  );
}
