import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { Clock, MapPin, MessageSquare, Ruler, Wallet } from 'lucide-react';
import type { DemandDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Badge } from '@lokacia/ui';
import { BusinessTypeIcon } from '../business-type-icon';

export function daysLeft(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}

export function areaRange(d: Pick<DemandDto, 'areaMin' | 'areaMax'>, unit = 'მ²') {
  if (d.areaMin && d.areaMax) return `${d.areaMin}–${d.areaMax} ${unit}`;
  if (d.areaMin) return `${d.areaMin}+ ${unit}`;
  if (d.areaMax) return `≤ ${d.areaMax} ${unit}`;
  return '—';
}

export function DemandStatusBadge({ status }: { status: DemandDto['status'] }) {
  const t = useTranslations('demand.status');
  return <Badge tone={status === 'active' ? 'success' : status === 'expired' ? 'outline' : 'neutral'}>{t(status)}</Badge>;
}

/** One demand request on the board (P6). Works in server and client trees. */
export function DemandCard({ d, icon, showStatus }: { d: DemandDto; icon?: string; showStatus?: boolean }) {
  const t = useTranslations('demand.card');
  const f = useFormat();
  const left = daysLeft(d.expiresAt);
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="primary" icon={<BusinessTypeIcon name={icon ?? 'store'} className="size-3.5" />}>
          {d.businessTypeName}
        </Badge>
        <Badge tone="outline">{f.dealType(d.dealType)}</Badge>
        {showStatus && <DemandStatusBadge status={d.status} />}
      </div>
      <h3 className="text-[17px] font-semibold leading-snug">
        <Link href={`/demand/${d.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          {d.title}
        </Link>
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-small">
        <div className="flex items-center gap-1.5">
          <Ruler className="size-3.5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
          <dt className="sr-only">{t('area')}</dt>
          <dd className="tabular">{areaRange(d, f.areaUnit)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Wallet className="size-3.5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
          <dt className="sr-only">{t('budget')}</dt>
          <dd className="tabular">{d.budgetMinor ? `≤ ${f.money(d.budgetMinor)}` : t('budgetAny')}</dd>
        </div>
        <div className="col-span-2 flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
          <dt className="sr-only">{t('districts')}</dt>
          <dd className="line-clamp-2">{d.districts.length ? d.districts.map((x) => x.name).join(', ') : t('anyDistrict')}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-small text-muted">
        <span className="truncate">
          {d.requester.name}
          {d.requester.companyName ? ` · ${d.requester.companyName}` : d.requester.activity ? ` · ${d.requester.activity}` : ''}
        </span>
        <span className="flex items-center gap-3">
          {d.contactsCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular">
              <MessageSquare className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t('contacts', { count: d.contactsCount })}
            </span>
          )}
          {d.status === 'active' && (
            <span className="inline-flex items-center gap-1 tabular">
              <Clock className="size-3.5" strokeWidth={1.5} aria-hidden />
              {left === 0 ? t('expiresToday') : t('expiresIn', { days: left })}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
