'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check, Eye, Inbox as InboxIcon, Link2, MessageSquare, Sparkles, Star, UserRound } from 'lucide-react';
import { formatDateTimeKa, type FeedbackDto } from '@lokacia/contracts';
import { Avatar, EmptyState, Tabs, cn } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { StatusPill } from '@/components/kit';

type Status = FeedbackDto['status'];
const STATUS_ICON: Record<Status, React.ElementType> = { new: Sparkles, seen: Eye, done: Check };

function Inbox({ status }: { status: Status | 'all' }) {
  const t = useTranslations('feedback');
  const { data, error, mutate } = useSWR<FeedbackDto[]>(`/admin/feedback${status === 'all' ? '' : `?status=${status}`}`, fetcher);
  const { run } = useAction();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} icon={<InboxIcon className="size-6" strokeWidth={2} aria-hidden />} />;
  const change = async (id: string, s: Status) => {
    if (await run(() => apiFetch(`/admin/feedback/${id}`, { method: 'PATCH', body: { status: s } }), t('updated'))) await mutate();
  };
  return (
    <ul className="flex flex-col gap-4">
      {data.map((f) => (
        <li key={f.id} className={cn('card relative overflow-hidden p-4 md:p-5', f.status === 'new' && 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent')}>
          <div className="flex gap-3 md:gap-4">
            {f.userId ? (
              <Avatar name={f.userName ?? t('user')} size={44} className="ring-0" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                <UserRound className="size-5" strokeWidth={2} aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-bold">
                  {f.userId ? (
                    <Link href={`/users/${f.userId}`} className="hover:text-link hover:underline">
                      {f.userName ?? t('user')}
                    </Link>
                  ) : (
                    t('guest')
                  )}
                </span>
                <span className="text-[13px] text-muted tabular">{formatDateTimeKa(f.createdAt)}</span>
                {f.rating && (
                  <span className="inline-flex items-center gap-0.5" role="img" aria-label={t('rating', { rating: f.rating })}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={cn('size-4', i < f.rating! ? 'fill-accent text-accent' : 'text-border-strong')} strokeWidth={2} aria-hidden />
                    ))}
                  </span>
                )}
                <StatusPill tone={f.status === 'new' ? 'accent' : f.status === 'done' ? 'success' : 'neutral'} className="ml-auto" pulse={f.status === 'new'}>
                  {t(`status.${f.status}`)}
                </StatusPill>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] text-muted">{f.app}</span>
                {f.path && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] text-muted">
                    <Link2 className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="truncate">{f.path}</span>
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line rounded-2xl rounded-tl-md bg-surface-2/70 px-4 py-3 text-[15.5px] leading-relaxed [overflow-wrap:anywhere]">{f.message}</p>
              <div role="group" aria-label={t('changeStatus')} className="mt-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
                {(['new', 'seen', 'done'] as const).map((s) => {
                  const Icon = STATUS_ICON[s];
                  const on = f.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => !on && change(f.id, s)}
                      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition-all focus-visible:shadow-ring focus-visible:outline-none', on ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
                    >
                      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                      {t(`status.${s}`)}
                    </button>
                  );
                })}
              </div>
            </div>
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
      <PageHeader icon={MessageSquare} title={t('title')} subtitle={t('subtitle')} />
      <div className="max-w-4xl">
        <Tabs tabs={(['new', 'seen', 'done', 'all'] as const).map((s) => ({ value: s, label: t(`tabs.${s}`), content: <Inbox status={s} /> }))} />
      </div>
    </>
  );
}
