import * as React from 'react';
import { cn } from '@lokacia/ui';
import { Breadcrumbs, type Crumb } from './seo';
import { HeroGlow } from './hero-glow';

export { HeroGlow };

/**
 * v2 page header band for public portal pages: soft tinted surface with warm/green glows,
 * breadcrumbs, eyebrow pill, bold display title, lead paragraph, actions and an optional footer slot (stats, chips, filters).
 */
export function PageHero({
  crumbs,
  eyebrow,
  eyebrowIcon,
  title,
  lead,
  actions,
  aside,
  children,
  className,
  size = 'md',
}: {
  crumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  /** Right column (desktop) — e.g. an illustration or a highlight card. */
  aside?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <section className={cn('relative isolate overflow-hidden border-b border-border bg-surface', className)}>
      <HeroGlow />
      <div className={cn('container-page relative', size === 'sm' ? 'pb-8 pt-6 md:pb-10 md:pt-8' : 'pb-10 pt-6 md:pb-14 md:pt-8')}>
        {crumbs && <Breadcrumbs items={crumbs} className="mb-6 md:mb-8" />}
        <div className={cn('grid items-end gap-6', aside ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : actions ? 'md:grid-cols-[minmax(0,1fr)_auto]' : '')}>
          <div className="min-w-0 max-w-3xl">
            {eyebrow && (
              <p className="eyebrow">
                {eyebrowIcon}
                {eyebrow}
              </p>
            )}
            <h1 className={cn('mt-4 break-words font-bold tracking-tight text-text', size === 'sm' ? 'text-[30px] leading-[38px] md:text-[40px] md:leading-[48px]' : 'text-[32px] leading-[40px] md:text-h1')}>{title}</h1>
            {lead && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted md:text-[18px]">{lead}</p>}
          </div>
          {aside ? <div className="hidden lg:block">{aside}</div> : actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
        </div>
        {aside && actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

/** Tinted icon tile (brand v2). */
export function IconTile({ children, tone = 'primary', size = 'md', className }: { children: React.ReactNode; tone?: 'primary' | 'accent' | 'link' | 'success' | 'danger'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tones = {
    primary: 'bg-primary-soft text-primary-soft-text',
    accent: 'bg-accent-soft text-text',
    link: 'bg-link/10 text-link',
    success: 'bg-success/12 text-success',
    danger: 'bg-danger/10 text-danger',
  } as const;
  const sizes = { sm: 'size-9 rounded-xl', md: 'size-11 rounded-2xl', lg: 'size-14 rounded-2xl' } as const;
  return <span className={cn('grid shrink-0 place-items-center', tones[tone], sizes[size], className)}>{children}</span>;
}

/** Big-number stat pill used in hero footers. */
export function HeroStat({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface/80 p-4 shadow-xs backdrop-blur">
      {icon && <IconTile size="sm" className="hidden sm:grid">{icon}</IconTile>}
      <div className="flex min-w-0 flex-col-reverse">
        <dt className="line-clamp-2 text-[13px] leading-[18px] text-muted">{label}</dt>
        <dd className="truncate text-[22px] font-bold leading-tight tracking-tight tabular">{value}</dd>
      </div>
    </div>
  );
}

/** Section header: title + optional lead + action (v2 rhythm). */
export function SectionHead({ id, title, lead, action, eyebrow, className }: { id?: string; title: React.ReactNode; lead?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 id={id} className="text-[24px] font-bold leading-tight tracking-tight md:text-[30px] md:leading-[38px]">
          {title}
        </h2>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** Stat card with tinted icon tile (dt/dd — place inside a <dl>). */
export function StatTile({ icon, label, value, tone = 'primary' }: { icon: React.ReactNode; label: React.ReactNode; value: React.ReactNode; tone?: 'primary' | 'accent' | 'link' | 'success' }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="flex min-w-0 flex-col">
        <dt className="text-small text-muted">{label}</dt>
        <dd className="text-[30px] font-bold leading-tight tracking-tight tabular">{value}</dd>
      </div>
    </div>
  );
}
