'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarRange, ChevronRight, FileSignature, Gift, GitCommitVertical } from 'lucide-react';
import type { OfferThreadSummary } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Button, Skeleton, Tabs, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { OfferStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';
import { AccountEmpty, Thumb } from '../ui';

function ThreadCard({ s }: { s: OfferThreadSummary }) {
  const t = useTranslations('offers.inbox');
  const f = useFormat();
  const isSale = s.listing.dealType === 'sale' || s.listing.dealType === 'transfer';
  return (
    <li>
      <Link href={`/account/offers/${s.latest.id}`} className={cn('card card-hover group flex gap-3 p-3 sm:gap-5 sm:p-4', s.actionRequired && 'ring-1 ring-inset ring-accent/60')}>
        <Thumb src={s.listing.cover} className="size-20 sm:aspect-[4/3] sm:h-auto sm:w-40" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={s.latest.status} />
            {s.actionRequired && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[12.5px] font-semibold">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                {t('actionRequired')}
              </span>
            )}
            <span className="ml-auto text-[13px] text-muted">{f.relativeDays(s.latest.createdAt)}</span>
          </div>
          <div className="line-clamp-1 font-semibold group-hover:text-link">{s.listing.title}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[20px] font-bold leading-7 tracking-tight tabular">{f.money(s.latest.priceMinor)}</span>
            {!isSale && (
              <>
                <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-[13px] font-medium tabular">
                  <CalendarRange className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
                  {t('termShort', { months: s.latest.termMonths })}
                </span>
                {s.latest.freeMonths ? (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full bg-success/10 px-2.5 text-[13px] font-medium text-success tabular">
                    <Gift className="size-3.5" strokeWidth={2} aria-hidden />
                    {t('freeShort', { months: s.latest.freeMonths })}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 text-[13px] text-muted">
            <Avatar src={s.counterpart.avatarUrl} name={s.counterpart.name} size={24} />
            <span className="truncate">
              {s.direction === 'received' ? t('from') : t('to')}: <span className="font-medium text-text">{s.counterpart.name ?? '—'}</span>
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-1">
              <GitCommitVertical className="size-3.5" strokeWidth={2} aria-hidden />
              {t('steps', { count: s.count })}
            </span>
            <ChevronRight className="hidden size-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" strokeWidth={2} aria-hidden />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function OffersInbox() {
  const t = useTranslations('offers.inbox');
  const params = useSearchParams();
  const [tab, setTab] = React.useState(() => (['received', 'sent'].includes(params.get('box') ?? '') ? params.get('box')! : 'all'));
  const { data, error, isLoading, mutate } = useSWR<OfferThreadSummary[]>('/offers?box=all', fetcher, { refreshInterval: 30_000 });
  useRealtime('notification', () => void mutate());
  const all = data ?? [];
  const received = all.filter((s) => s.direction === 'received');
  const sent = all.filter((s) => s.direction === 'sent');
  const list = (items: OfferThreadSummary[], empty: 'emptyAll' | 'emptyReceived' | 'emptySent') => {
    if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-card" />)}</div>;
    if (error) return <p className="text-danger" role="alert">{t('loadError')}</p>;
    if (!items.length)
      return (
        <AccountEmpty
          icon={FileSignature}
          title={t(empty)}
          description={t('emptyHint')}
          action={
            <Button asChild>
              <Link href="/search">{t('searchCta')}</Link>
            </Button>
          }
        />
      );
    return <ul className="flex flex-col gap-3">{items.map((s) => <ThreadCard key={s.rootId} s={s} />)}</ul>;
  };
  return (
    <div aria-live="polite">
      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'all', label: t('tabAll'), count: all.length, content: list(all, 'emptyAll') },
          { value: 'received', label: t('tabReceived'), count: received.length, content: list(received, 'emptyReceived') },
          { value: 'sent', label: t('tabSent'), count: sent.length, content: list(sent, 'emptySent') },
        ]}
      />
    </div>
  );
}
