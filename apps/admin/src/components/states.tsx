'use client';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button, Skeleton } from '@lokacia/ui';
import { problemMessage } from '@/lib/use-action';

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card flex flex-col gap-3 p-5" aria-busy="true">
      <Skeleton className="h-5 w-1/3 rounded-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 rounded-full" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
            <Skeleton className="h-3 w-1/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div role="alert" className="card flex flex-wrap items-center gap-4 border-danger/30 p-4 md:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
        <AlertTriangle className="size-[18px]" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 font-medium text-danger [overflow-wrap:anywhere]">{problemMessage(error)}</span>
      {retry && (
        <Button size="sm" variant="secondary" icon={<RotateCw className="size-4" strokeWidth={2} aria-hidden />} onClick={retry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
