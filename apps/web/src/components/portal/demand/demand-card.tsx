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
  const who = d.requester.companyName ?? d.requester.activity ?? null;
  return (
    <article className="card card-hover group relative flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text transition-transform duration-300 group-hover:scale-105">
          <BusinessTypeIcon name={icon ?? 'store'} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-small font-semibold text-primary-soft-text">{d.businessTypeName}</span>
            <Badge tone="outline" className="h-6">
              {f.dealType(d.dealType)}
            </Badge>
            {showStatus && <DemandStatusBadge status={d.status} />}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[17px] font-semibold leading-snug">
            <Link href={`/demand/${d.id}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
              {d.title}
            </Link>
          </h3>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-small">
        <div className="flex flex-col rounded-xl bg-surface-2 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <Ruler className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {t('area')}
          </dt>
          <dd className="mt-0.5 truncate font-semibold tabular">{areaRange(d, f.areaUnit)}</dd>
        </div>
        <div className="flex flex-col rounded-xl bg-surface-2 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <Wallet className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {t('budget')}
          </dt>
          <dd className="mt-0.5 truncate font-semibold tabular">{d.budgetMinor ? `≤ ${f.money(d.budgetMinor)}` : t('budgetAny')}</dd>
        </div>
        <div className="col-span-2 flex items-start gap-1.5 px-1 text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
          <dt className="sr-only">{t('districts')}</dt>
          <dd className="line-clamp-2 text-text">{d.districts.length ? d.districts.map((x) => x.name).join(', ') : t('anyDistrict')}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-small text-muted">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[12px] font-semibold text-text">
            {(d.requester.name ?? '?').slice(0, 1)}
          </span>
          <span className="truncate">
            {d.requester.name}
            {who ? ` · ${who}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {d.contactsCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular">
              <MessageSquare className="size-3.5" strokeWidth={2} aria-hidden />
              {t('contacts', { count: d.contactsCount })}
            </span>
          )}
          {d.status === 'active' && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular ${left <= 3 ? 'bg-accent-soft text-text' : 'bg-surface-2'}`}>
              <Clock className="size-3.5" strokeWidth={2} aria-hidden />
              {left === 0 ? t('expiresToday') : t('expiresIn', { days: left })}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
