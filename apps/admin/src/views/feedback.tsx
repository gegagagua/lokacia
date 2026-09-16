'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { formatDateTimeKa, type FeedbackDto } from '@lokacia/contracts';
import { Badge, EmptyState, Select, Tabs } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

type Status = FeedbackDto['status'];

function Inbox({ status }: { status: Status | 'all' }) {
  const t = useTranslations('feedback');
  const { data, error, mutate } = useSWR<FeedbackDto[]>(`/admin/feedback${status === 'all' ? '' : `?status=${status}`}`, fetcher);
  const { run } = useAction();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} />;
  const change = async (id: string, s: Status) => {
    if (await run(() => apiFetch(`/admin/feedback/${id}`, { method: 'PATCH', body: { status: s } }), t('updated'))) await mutate();
  };
  return (
    <ul className="flex flex-col gap-2">
      {data.map((f) => (
        <li key={f.id} className="rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-small text-muted">
            <Badge tone={f.status === 'new' ? 'accent' : f.status === 'done' ? 'success' : 'neutral'}>{t(`status.${f.status}`)}</Badge>
            <span className="font-mono text-[12px]">{f.app}</span>
            {f.path && <span className="max-w-[260px] truncate font-mono text-[12px]">{f.path}</span>}
            {f.rating && (
              <span className="inline-flex items-center gap-0.5" aria-label={t('rating', { rating: f.rating })}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`size-3.5 ${i < f.rating! ? 'fill-accent text-accent' : 'text-border-strong'}`} strokeWidth={1.5} aria-hidden />
                ))}
              </span>
            )}
            <span className="tabular">{formatDateTimeKa(f.createdAt)}</span>
            <span>
              {f.userId ? (
                <Link href={`/users/${f.userId}`} className="text-link hover:underline">
                  {f.userName ?? t('user')}
                </Link>
              ) : (
                t('guest')
              )}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-[15px]">{f.message}</p>
          <div className="mt-3 w-48">
            <Select aria-label={t('changeStatus')} value={f.status} onChange={(e) => change(f.id, e.target.value as Status)} options={(['new', 'seen', 'done'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FeedbackView() {
  const t = useTranslations('feedback');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Tabs tabs={(['new', 'seen', 'done', 'all'] as const).map((s) => ({ value: s, label: t(`tabs.${s}`), content: <Inbox status={s} /> }))} />
    </>
  );
}
