'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ExternalLink, MessageSquareQuote, RefreshCw, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatArea, formatMoney, MATCH_STATUSES, type MatchStatus } from '@lokacia/contracts';
import { Button, Checkbox, cn, EmptyState, Skeleton, useToast } from '@lokacia/ui';
import { Pill, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';
import type { ContactMatch } from './types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
const TONE: Record<MatchStatus, Tone> = { new: 2, sent: 4, liked: 'success', disliked: 'danger', dismissed: 'neutral' };

/** C2 matches tab: score, client feedback from the portal (C8), select → send to portal, dismiss. */
export function MatchesPanel({ contactId, onChanged }: { contactId: string; onChanged?: () => void }) {
  const t = useTranslations('contacts.matches');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<ContactMatch[]>(`/crm/contacts/${contactId}/matches`);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<MatchStatus | 'all'>('all');
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await mutate();
      onChanged?.();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const items = (data ?? []).filter((m) => filter === 'all' || m.status === filter);
  const counts = Object.fromEntries(MATCH_STATUSES.map((s) => [s, (data ?? []).filter((m) => m.status === s).length]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('feedback')} className="flex flex-wrap gap-1.5">
          {(['all', ...MATCH_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium transition-all duration-200', filter === s ? 'border-transparent bg-text text-surface shadow-sm' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text')}
            >
              {s === 'all' ? t('filterAll') : t(`status.${s}`)}
              <span className={cn('rounded-full px-1.5 text-[11.5px] tabular', filter === s ? 'bg-surface/20' : 'bg-surface-2')}>{s === 'all' ? (data?.length ?? 0) : counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'refresh'}
            icon={<RefreshCw className="size-3.5" strokeWidth={2} aria-hidden />}
            onClick={() =>
              run('refresh', async () => {
                const r = await mutateApi<{ created: number }>(`/crm/contacts/${contactId}/matches/refresh`);
                toast({ title: t('refreshed', { count: r.created }) });
              })
            }
          >
            {t('refresh')}
          </Button>
          <Button
            size="sm"
            disabled={!selected.length}
            loading={busy === 'send'}
            icon={<Send className="size-3.5" strokeWidth={2} aria-hidden />}
            onClick={() =>
              run('send', async () => {
                const r = await mutateApi<{ sent: number }>(`/crm/contacts/${contactId}/portal/send`, { body: { matchIds: selected } });
                setSelected([]);
                toast({ title: t('sent', { count: r.sent }), tone: 'success' });
              })
            }
          >
            {t('send')} {selected.length ? `(${selected.length})` : ''}
          </Button>
        </div>
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {data && items.length === 0 && <EmptyState icon={<Building2 className="size-5" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} />}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((m) => {
          const l = m.listing;
          const checked = selected.includes(m.id);
          return (
            <li key={m.id} className={cn('card card-hover group flex flex-col overflow-hidden', checked && 'border-primary shadow-ring', m.status === 'dismissed' && 'opacity-60')}>
              <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                {l.cover ? <img src={l.cover} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" /> : <div className="drawing-grid size-full" />}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-1">
                  <span className="inline-flex h-7 items-center rounded-full bg-accent px-2.5 text-[12.5px] font-bold text-accent-contrast shadow-sm tabular">{t('score', { score: m.score })}</span>
                  <span className="rounded-full bg-surface shadow-sm">
                    <Pill tone={TONE[m.status]} icon={m.status === 'liked' ? ThumbsUp : m.status === 'disliked' ? ThumbsDown : undefined} dot={m.status !== 'liked' && m.status !== 'disliked'}>
                      {t(`status.${m.status}`)}
                    </Pill>
                  </span>
                </div>
                <span className="absolute bottom-2.5 left-3 text-[18px] font-bold text-white drop-shadow tabular">{formatMoney(l.priceMinor)}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-start gap-2">
                  {m.status !== 'dismissed' && <Checkbox checked={checked} onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, m.id] : s.filter((x) => x !== m.id)))} aria-label={`${t('select')}: ${l.title}`} className="mt-0.5" />}
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-medium leading-snug">{l.title}</div>
                    <div className="truncate text-small text-muted">{l.districtName ? `${l.districtName} · ` : ''}{l.address}</div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[13px] text-muted tabular">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{formatArea(l.areaM2)}</span>
                </div>
                {m.clientComment && (
                  <p className="mt-2 flex gap-2 rounded-2xl rounded-tl-md bg-primary-soft px-3 py-2 text-[13.5px] text-primary-soft-text">
                    <MessageSquareQuote className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-label={t('clientComment')} />
                    {m.clientComment}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <a href={`${APP_URL}/listings/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-small text-link hover:underline">
                    {t('open')} <ExternalLink className="size-3" strokeWidth={2} aria-hidden />
                  </a>
                  {(m.status === 'new' || m.status === 'dismissed') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy === m.id}
                      onClick={() => run(m.id, () => mutateApi(`/crm/contacts/${contactId}/matches/${m.id}`, { method: 'PATCH', body: { status: m.status === 'dismissed' ? 'new' : 'dismissed' } }).then(() => undefined))}
                    >
                      {m.status === 'dismissed' ? t('restore') : t('dismiss')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
