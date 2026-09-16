import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, CircleCheck, ClipboardCheck } from 'lucide-react';
import { getPermits } from '../data';

/** P12: permits checklist for the listing's business type (markdown managed in admin), rendered as checklist cards. */
export async function PermitsChecklist({ businessType, typeName }: { businessType: string; typeName: string }) {
  const page = await getPermits(businessType);
  if (!page) return null;
  const t = await getTranslations('listing.permits');
  return (
    <details className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition-colors hover:bg-surface-2/60 md:p-7 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start gap-3.5">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success/12 text-success">
            <ClipboardCheck className="size-5" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[22px] font-bold leading-tight tracking-tight md:text-[24px]">{t('title')}</span>
            <span className="mt-1 block text-[15px] text-muted">{t('subtitle', { type: typeName })}</span>
          </span>
        </span>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition-transform duration-200 group-open:rotate-180">
          <ChevronDown className="size-5" strokeWidth={2} />
        </span>
      </summary>
      <div className="border-t border-border px-5 pb-6 pt-5 md:px-7">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: () => null,
            h2: ({ children }) => <h3 className="mb-3 mt-5 text-[17px] font-bold first:mt-0">{children}</h3>,
            h3: ({ children }) => <h3 className="mb-3 mt-5 text-[16px] font-bold first:mt-0">{children}</h3>,
            p: ({ children }) => <p className="mb-4 text-[15px] text-muted">{children}</p>,
            ul: ({ children }) => <ul className="mb-4 grid gap-3 sm:grid-cols-2">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 grid gap-3 sm:grid-cols-2">{children}</ol>,
            li: ({ children }) => (
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2/50 p-4 text-[15px] leading-snug [&_strong]:block [&_strong]:text-text">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={2} aria-hidden />
                <span className="min-w-0 text-muted">{children as ReactNode}</span>
              </li>
            ),
            input: () => null,
            a: ({ children, href }) => (
              <a href={href} className="text-link underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            blockquote: ({ children }) => <blockquote className="mt-2 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] [&_p]:mb-0 [&_p]:text-text">{children}</blockquote>,
          }}
        >
          {page.bodyMd}
        </ReactMarkdown>
      </div>
    </details>
  );
}
