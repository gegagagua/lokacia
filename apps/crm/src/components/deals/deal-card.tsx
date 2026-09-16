'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, UserRound } from 'lucide-react';
import { formatMoney, type DealCard } from '@lokacia/contracts';
import { Avatar } from '@lokacia/ui';

export function DealCardView({ deal }: { deal: DealCard }) {
  const t = useTranslations('deals');
  return (
    <article className="rounded-[8px] border border-border bg-surface p-2.5 text-[13px] hover:border-border-strong">
      <Link href={`/deals/${deal.id}`} className="block font-medium leading-snug text-text hover:underline">
        {deal.title}
      </Link>
      {deal.contactName && (
        <div className="mt-1 flex items-center gap-1 text-muted">
          <UserRound className="size-3 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="truncate">{deal.contactName}</span>
        </div>
      )}
      {deal.listingTitle && (
        <div className="mt-0.5 flex items-center gap-1 text-muted">
          <Building2 className="size-3 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="truncate">{deal.listingTitle}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-border pt-1.5">
        <span className="tabular font-medium">{deal.valueMinor != null ? formatMoney(deal.valueMinor) : ''}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted tabular">
          {t('daysInStage', { days: deal.daysInStage })}
          <Avatar name={deal.agentName} size={20} className="text-[9px]" />
        </span>
      </div>
      {deal.lostReason && <div className="mt-1 truncate text-[11px] text-danger">{deal.lostReason}</div>}
    </article>
  );
}
