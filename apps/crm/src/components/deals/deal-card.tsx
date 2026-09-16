'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, CalendarClock, Clock3 } from 'lucide-react';
import { formatMoney, type DealCard } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { PersonAvatar, toneFor } from '@/components/common/ui';

const DAY = 86_400_000;

/** Pipeline stage colour: open stages cycle through the tone palette; won = success, lost = danger. */
const OPEN_TONES = [2, 4, 6, 3, 7, 5, 1] as const;
export function stageColor(kind: 'open' | 'won' | 'lost', openIndex: number) {
  if (kind === 'won') return 'var(--success)';
  if (kind === 'lost') return 'var(--danger)';
  return `var(--tone-${OPEN_TONES[openIndex % OPEN_TONES.length]})`;
}

/** Due indicator from expected close date (open deals only). */
export function dueState(deal: Pick<DealCard, 'expectedCloseAt' | 'closedAt'>): 'overdue' | 'soon' | 'later' | null {
  if (!deal.expectedCloseAt || deal.closedAt) return null;
  const diff = new Date(deal.expectedCloseAt).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 7 * DAY) return 'soon';
  return 'later';
}

export function DealCardView({ deal, showValue = true, stage }: { deal: DealCard; showValue?: boolean; stage?: { name: string; color: string } }) {
  const t = useTranslations('deals');
  const due = dueState(deal);
  const stale = deal.daysInStage >= 60 ? 'danger' : deal.daysInStage >= 30 ? 'warn' : 'ok';
  const closeDate = deal.expectedCloseAt ? new Date(deal.expectedCloseAt) : null;
  return (
    <article className="group relative rounded-2xl border border-border bg-surface p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <PersonAvatar name={deal.contactName ?? deal.title} size={34} />
        <div className="min-w-0 flex-1">
          <Link href={`/deals/${deal.id}`} className="line-clamp-2 text-[14px] font-semibold leading-5 text-text after:absolute after:inset-0 after:rounded-2xl hover:text-primary-soft-text focus-visible:outline-none">
            {deal.title}
          </Link>
          {deal.contactName && <div className="mt-0.5 truncate text-[12.5px] text-muted">{deal.contactName}</div>}
        </div>
      </div>

      {deal.listingTitle && (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-surface-2 p-2">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-[10px] bg-tone-soft text-tone-ink', `tone-${toneFor(deal.listingId ?? deal.listingTitle)}`)} aria-hidden>
            <Building2 className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium leading-4">{deal.listingTitle}</div>
            {deal.listingAddress && <div className="truncate text-[11.5px] leading-4 text-muted">{deal.listingAddress}</div>}
          </div>
        </div>
      )}

      {((showValue && deal.valueMinor != null) || stage) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {showValue && deal.valueMinor != null ? <span className="text-[17px] font-bold leading-6 tracking-tight tabular">{formatMoney(deal.valueMinor)}</span> : <span />}
          {stage && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold" style={{ background: `color-mix(in srgb, ${stage.color} 14%, transparent)`, color: `color-mix(in srgb, ${stage.color} 72%, var(--text))` }}>
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: stage.color }} />
              {stage.name}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold tabular',
            stale === 'danger' ? 'bg-danger/10 text-danger' : stale === 'warn' ? 'bg-accent-soft text-text' : 'bg-surface-2 text-muted',
          )}
          title={t('daysInStage', { days: deal.daysInStage })}
        >
          <Clock3 className="size-3" strokeWidth={2.2} aria-hidden />
          {t('daysShort', { days: deal.daysInStage })}
        </span>
        {due && closeDate && (
          <span
            className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold tabular', due === 'overdue' ? 'bg-danger/10 text-danger' : due === 'soon' ? 'bg-accent-soft text-text' : 'bg-surface-2 text-muted')}
            title={`${t('fields.expectedCloseAt')}: ${closeDate.toLocaleDateString('ka-GE')}`}
          >
            <CalendarClock className="size-3" strokeWidth={2.2} aria-hidden />
            {due === 'overdue' ? t('due.overdue') : `${closeDate.getDate()}.${String(closeDate.getMonth() + 1).padStart(2, '0')}`}
          </span>
        )}
        <span className="ml-auto" title={deal.agentName ?? undefined}>
          <PersonAvatar name={deal.agentName} size={24} ring />
          <span className="sr-only">
            {t('agent')}: {deal.agentName ?? '—'}
          </span>
        </span>
      </div>
      {deal.lostReason && <div className="mt-2 truncate rounded-lg bg-danger/8 px-2 py-1 text-[12px] font-medium text-danger">{deal.lostReason}</div>}
    </article>
  );
}
