import Link from '@/i18n/link';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Building2, CalendarClock, MapPin } from 'lucide-react';
import type { ProjectDto } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';

export function monthsUntil(date: string, now = new Date()) {
  const d = new Date(date);
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
}

/** Project card for the /projects list (cadastral style: facade drawing, precise figures). */
export async function ProjectCard({ project: p, priority }: { project: ProjectDto; priority?: boolean }) {
  const t = await getTranslations('projects');
  const f = await getFormat();
  const months = monthsUntil(p.completionDate);
  return (
    <article className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/90 px-2.5 text-[12.5px] font-semibold text-basalt shadow-xs backdrop-blur">
          <CalendarClock className="size-3.5" strokeWidth={2} aria-hidden />
          {months > 0 ? t('inMonths', { n: months }) : t('completed')}
        </span>
        {p.minPriceMinor != null && (
          <span className="absolute bottom-3 left-3 rounded-full bg-accent px-3 py-1 text-[14px] font-bold text-accent-contrast shadow-sm tabular">{t('priceFrom', { price: f.money(p.minPriceMinor) })}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="text-h3 font-bold tracking-tight">
          <Link href={`/projects/${p.slug}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
            {p.name}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-[14px] text-muted">
          <MapPin className="size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
          <span className="truncate">{p.district ? `${p.district.name} · ` : ''}{p.address}</span>
        </p>
        <dl className="mt-1 grid grid-cols-3 gap-2 text-small">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2">
            <dt className="text-[12px] text-muted">{t('completion')}</dt>
            <dd className="font-semibold leading-snug tabular">{f.date(p.completionDate)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2">
            <dt className="text-[12px] text-muted">{t('units')}</dt>
            <dd className="font-semibold leading-snug tabular">{t('unitsCount', { n: p.unitsCount })}</dd>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2">
            <dt className="text-[12px] text-muted">{t('col.area')}</dt>
            <dd className="font-semibold leading-snug tabular">{p.minAreaM2 != null && p.maxAreaM2 != null ? t('areaRange', { min: f.number(p.minAreaM2), max: f.number(p.maxAreaM2) }) : '—'}</dd>
          </div>
        </dl>
        <p className="relative z-10 mt-auto flex items-center gap-2 border-t border-border pt-3 text-small">
          <span className="text-muted">{t('developer')}:</span>
          <Link href={`/agency/${p.developer.slug}`} className="truncate font-medium text-link hover:underline">
            {p.developer.name}
          </Link>
          {p.developer.verified && <BadgeCheck className="size-4 shrink-0 text-success" strokeWidth={2} aria-label={t('verified')} />}
        </p>
      </div>
    </article>
  );
}
