'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { FileSignature } from 'lucide-react';
import type { OfferThreadSummary } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Button, EmptyState, Skeleton, Tabs } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { OfferStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';

function ThreadCard({ s }: { s: OfferThreadSummary }) {
  const t = useTranslations('offers.inbox');
  const f = useFormat();
  const isSale = s.listing.dealType === 'sale' || s.listing.dealType === 'transfer';
  return (
    <li>
      <Link href={`/account/offers/${s.latest.id}`} className="flex gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:border-border-strong sm:gap-4 sm:p-4">
        <div className="hidden aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-photo border border-border bg-surface-2 sm:block">
          {s.listing.cover ? <img src={s.listing.cover} alt="" className="size-full object-cover" /> : <div className="drawing-grid size-full" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={s.latest.status} />
            {s.actionRequired && (
              <span className="inline-flex items-center gap-1.5 text-small font-medium">
                <span className="size-2 rounded-full bg-accent" aria-hidden />
                {t('actionRequired')}
              </span>
            )}
            <span className="ml-auto text-small text-muted">{f.relativeDays(s.latest.createdAt)}</span>
          </div>
          <div className="mt-1 line-clamp-1 font-medium">{s.listing.title}</div>
          <div className="mt-1 text-[15px] tabular">
            <span className="font-semibold">{f.money(s.latest.priceMinor)}</span>
            {!isSale && (
              <span className="text-muted">
                {' '}
                · {t('termShort', { months: s.latest.termMonths })}
                {s.latest.freeMonths ? ` · ${t('freeShort', { months: s.latest.freeMonths })}` : ''}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-small text-muted">
            <Avatar src={s.counterpart.avatarUrl} name={s.counterpart.name} size={22} />
            <span className="truncate">
              {s.direction === 'received' ? t('from') : t('to')}: {s.counterpart.name ?? '—'}
            </span>
            <span aria-hidden>·</span>
            <span>{t('steps', { count: s.count })}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function OffersInbox() {
  const t = useTranslations('offers.inbox');
  const [tab, setTab] = React.useState('all');
  const { data, error, isLoading, mutate } = useSWR<OfferThreadSummary[]>('/offers?box=all', fetcher, { refreshInterval: 30_000 });
  useRealtime('notification', () => void mutate());
  const all = data ?? [];
  const received = all.filter((s) => s.direction === 'received');
  const sent = all.filter((s) => s.direction === 'sent');
  const list = (items: OfferThreadSummary[], empty: 'emptyAll' | 'emptyReceived' | 'emptySent') => {
    if (isLoading) return <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>;
    if (error) return <p className="text-danger" role="alert">{t('loadError')}</p>;
    if (!items.length)
      return (
        <EmptyState
          icon={<FileSignature className="size-6" strokeWidth={1.5} />}
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
