import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@lokacia/ui';

/** Page title block: optional back link + icon tile, bold title, muted lead, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  icon,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  icon?: React.ElementType;
  eyebrow?: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div className="min-w-0 flex-1 basis-72">
        {back && (
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-small font-medium text-muted transition-colors hover:bg-surface hover:text-text hover:shadow-xs"
          >
            <span className="grid size-6 place-items-center rounded-full bg-surface-2 transition-transform group-hover:-translate-x-0.5">
              <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            {back.label}
          </Link>
        )}
        <div className="flex items-start gap-4">
          {Icon && (
            <span className="mt-0.5 hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text shadow-xs sm:grid">
              <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
            <h1 className="text-[26px] font-bold leading-[1.2] tracking-tight [overflow-wrap:anywhere] md:text-[32px]">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-3xl text-[15px] text-muted md:text-body">{subtitle}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standalone back link (for pages whose h1 lives inside a hero card). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group mb-4 inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-small font-medium text-muted transition-colors hover:bg-surface hover:text-text hover:shadow-xs"
    >
      <span className="grid size-6 place-items-center rounded-full bg-surface-2 transition-transform group-hover:-translate-x-0.5">
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      {label}
    </Link>
  );
}

/** Card section with header row. `flush` removes body padding (for tables/lists that bleed to the edges). */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  icon,
  flush,
  bodyClassName,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  icon?: React.ElementType;
  flush?: boolean;
  bodyClassName?: string;
  id?: string;
}) {
  const Icon = icon;
  const headingId = React.useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn('card min-w-0 overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
              <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={headingId} className="text-[17px] font-bold leading-6 tracking-tight">
              {title}
            </h2>
            {description && <p className="text-small text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={cn(flush ? 'pt-3' : 'px-5 pb-5 pt-4 md:px-6 md:pb-6', bodyClassName)}>{children}</div>
    </section>
  );
}
