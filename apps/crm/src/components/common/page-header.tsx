'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@lokacia/ui';
import { NAV_ITEMS } from '@/lib/nav';

function iconForPath(pathname: string): LucideIcon | undefined {
  const best = NAV_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return best?.icon;
}

/**
 * Page title bar for CRM screens: tinted icon tile (auto from nav), bold title, muted description and actions (right).
 * Pass `icon={null}` to hide the tile (e.g. detail pages that render their own avatar).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  back,
  icon,
  meta,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  back?: React.ReactNode;
  icon?: LucideIcon | null;
  meta?: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const Icon = icon === null ? undefined : (icon ?? iconForPath(pathname));
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between', className)}>
      <div className="min-w-0">
        {back && <div className="mb-2 text-small text-muted [&_a:hover]:text-text [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1">{back}</div>}
        <div className="flex min-w-0 items-center gap-3.5">
          {Icon && (
            <span className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text shadow-xs ring-1 ring-inset ring-primary/10 sm:grid" aria-hidden>
              <Icon className="size-5" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-bold leading-8 tracking-tight md:text-[28px] md:leading-9">{title}</h1>
            {subtitle && <p className="mt-0.5 line-clamp-2 text-[14px] leading-5 text-muted">{subtitle}</p>}
          </div>
        </div>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </div>
  );
}
