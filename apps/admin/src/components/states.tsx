'use client';
import { useTranslations } from 'next-intl';
import { Button, Skeleton } from '@lokacia/ui';
import { problemMessage } from '@/lib/use-action';

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useTranslations('common');
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger px-4 py-3">
      <span className="text-danger">{problemMessage(error)}</span>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
