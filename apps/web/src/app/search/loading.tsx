import { Skeleton } from '@lokacia/ui';
import { CardSkeletons } from '@/components/portal/search/search-view';

export default function SearchLoading() {
  return (
    <div aria-busy="true">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-4 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-10 w-80 max-w-full" />
            <Skeleton className="h-12 w-full rounded-full lg:w-[560px]" />
          </div>
          <div className="mt-5 flex gap-2 overflow-hidden">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-32 shrink-0 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-3 md:px-8">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="ml-auto h-10 w-52 rounded-full" />
          <Skeleton className="hidden h-10 w-64 rounded-full sm:block" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <Skeleton className="hidden h-[620px] rounded-card lg:block" />
        <CardSkeletons count={6} cols={3} />
      </div>
    </div>
  );
}
