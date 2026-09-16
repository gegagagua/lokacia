import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2, CalendarClock, MapPin } from 'lucide-react';
import { formatDateKa, formatMoney, formatNumber, type ProjectDto } from '@lokacia/contracts';
import { Badge } from '@lokacia/ui';

export function monthsUntil(date: string, now = new Date()) {
  const d = new Date(date);
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
}

/** Project card for the /projects list (cadastral style: facade drawing, precise figures). */
export async function ProjectCard({ project: p, priority }: { project: ProjectDto; priority?: boolean }) {
  const t = await getTranslations('projects');
  const months = monthsUntil(p.completionDate);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors duration-150 hover:border-border-strong">
      <div className="drawing-grid relative aspect-[16/9] border-b border-border bg-bg">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <span className="absolute left-3 top-3">
          <Badge tone="primary" icon={<CalendarClock className="size-3.5" strokeWidth={1.5} aria-hidden />}>
            {months > 0 ? t('inMonths', { n: months }) : t('completed')}
          </Badge>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-h3 font-semibold">
          <Link href={`/projects/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {p.name}
          </Link>
        </h3>
        <p className="flex items-center gap-1 text-small text-muted">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="truncate">{p.district ? `${p.district.name} · ` : ''}{p.address}</span>
        </p>
        <p className="relative z-10 flex items-center gap-1 text-small">
          <span className="text-muted">{t('developer')}:</span>
          <Link href={`/agency/${p.developer.slug}`} className="text-link hover:underline">
            {p.developer.name}
          </Link>
          {p.developer.verified && <BadgeCheck className="size-3.5 text-success" strokeWidth={1.5} aria-label={t('verified')} />}
        </p>
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-small">
          <div>
            <dt className="text-muted">{t('completion')}</dt>
            <dd className="tabular font-medium">{formatDateKa(p.completionDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('units')}</dt>
            <dd className="tabular font-medium">{t('unitsCount', { n: p.unitsCount })}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('col.area')}</dt>
            <dd className="tabular font-medium">{p.minAreaM2 != null && p.maxAreaM2 != null ? t('areaRange', { min: formatNumber(p.minAreaM2), max: formatNumber(p.maxAreaM2) }) : '—'}</dd>
          </div>
        </dl>
        {p.minPriceMinor != null && <p className="compact text-[18px] font-semibold tabular">{t('priceFrom', { price: formatMoney(p.minPriceMinor) })}</p>}
      </div>
    </article>
  );
}
